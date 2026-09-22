"""Read-only local API for saved historical backtests. No NBA network requests."""
from collections import defaultdict
from contextlib import asynccontextmanager
import csv
from datetime import date as Date
import json
import math
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from player_api import player_router

DATA_DIR = Path(__file__).parent / "data" / "backtest"


def load_snapshot(folder):
    report = json.loads((folder / "report.json").read_text())
    games_by_date = defaultdict(list)
    dates_by_season = defaultdict(set)
    seen = set()
    with (folder / "predictions.csv").open(newline="") as file:
        for row in csv.DictReader(file):
            game_date = Date.fromisoformat(row["game_date"]).isoformat()
            p = float(row["home_win_probability"])
            if not math.isfinite(p) or not 0 <= p <= 1 or row["game_id"] in seen:
                raise ValueError("Invalid or duplicate prediction")
            seen.add(row["game_id"])
            home_score, away_score = int(row["home_score"]), int(row["away_score"])
            actual = int(row["actual_home_win"])
            if actual not in (0, 1) or actual != int(home_score > away_score) or home_score == away_score:
                raise ValueError("Prediction outcome disagrees with scores")
            game = dict(game_id=row["game_id"], season=row["season"], date=game_date,
                home_team=row["home_team"], away_team=row["away_team"],
                home_score=home_score, away_score=away_score,
                home_rating=float(row["home_rating"]), away_rating=float(row["away_rating"]),
                home_win_probability=p, away_win_probability=1-p,
                neutral_site=bool(int(row["neutral_site"])),
                predicted_winner=row["home_team"] if p >= 0.5 else row["away_team"],
                actual_winner=row["home_team"] if actual else row["away_team"],
                correct=(p >= 0.5) == bool(actual))
            games_by_date[game_date].append(game)
            dates_by_season[row["season"]].add(game_date)
    seasons = []
    for season, coverage in sorted(report["coverage"].items(), reverse=True):
        dates = sorted(dates_by_season[season])
        count = sum(g["season"] == season for games in games_by_date.values() for g in games)
        if not dates or count != coverage["games"]:
            raise ValueError("Report and predictions have different coverage")
        seasons.append(dict(season=season, first_date=dates[0], last_date=dates[-1],
            dates=dates, games=count,
            phase="Warm-up" if season == report["warmup_season"] else
                  "Initial test" if season == report["test_season"] else "Development"))
    if set(dates_by_season) != set(report["coverage"]):
        raise ValueError("Unexpected season in predictions")
    return report, dict(games_by_date), seasons


def create_app(data_dir=DATA_DIR):
    @asynccontextmanager
    async def lifespan(app):
        try:
            app.state.snapshot = load_snapshot(Path(data_dir))
        except (OSError, ValueError, KeyError, TypeError):
            app.state.snapshot = None
        yield

    app = FastAPI(title="NBA Forecast Lab", version="0.1.0", lifespan=lifespan)
    app.include_router(player_router())

    def snapshot():
        if app.state.snapshot is None:
            raise HTTPException(503, "Saved backtest is unavailable. Generate it with backend/evaluate_elo.py and restart the API.")
        return app.state.snapshot

    @app.get("/api/seasons")
    def seasons():
        report, _, available = snapshot()
        return dict(seasons=available, generated_at=report["generated_at"], mode="historical_backtest")

    @app.get("/api/games")
    def games(date: Date = Query(...)):
        _, by_date, _ = snapshot()
        selected = date.isoformat()
        return dict(date=selected, games=by_date.get(selected, []), mode="historical_backtest")

    @app.get("/api/model-performance")
    def performance():
        report, _, _ = snapshot()
        return report

    return app


app = create_app()
