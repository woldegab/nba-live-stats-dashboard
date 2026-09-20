"""Reproducible, chronological regular-season Elo backtest (not live forecasts)."""

import argparse
from collections import Counter, defaultdict
import csv
from datetime import datetime, timezone
from itertools import groupby
import hashlib
import json
import math
from pathlib import Path
import sqlite3

from import_games import DEFAULT_DB

# Fixed before evaluation; deliberately no search against the test season.
PARAMETERS = dict(initial_rating=1500.0, k=20.0, home_advantage=65.0, retention=0.75)
SEASONS = ("2023-24", "2024-25", "2025-26")


def backtest(games, parameters=None):
    p = PARAMETERS if parameters is None else parameters
    ratings = defaultdict(lambda: p["initial_rating"])
    predictions = []
    previous_season = None
    ordered = sorted(games, key=lambda g: (g["game_date"], g["game_id"]))
    for (_, season), daily_games in groupby(ordered, lambda g: (g["game_date"], g["season"])):
        if previous_season is not None and season != previous_season:
            for team in ratings:
                ratings[team] = p["initial_rating"] + p["retention"] * (ratings[team] - p["initial_rating"])
        previous_season = season
        updates = defaultdict(float)
        for game in daily_games:
            home, away = game["home_team_id"], game["away_team_id"]
            advantage = 0 if game["neutral_site"] else p["home_advantage"]
            probability = 1 / (1 + 10 ** ((ratings[away] - ratings[home] - advantage) / 400))
            actual = int(game["home_score"] > game["away_score"])
            predictions.append(dict(game_id=game["game_id"], season=season,
                game_date=game["game_date"], home_team=game["home_team"],
                away_team=game["away_team"], neutral_site=game["neutral_site"],
                home_rating=ratings[home], away_rating=ratings[away],
                home_win_probability=probability, actual_home_win=actual,
                home_score=game["home_score"], away_score=game["away_score"]))
            delta = p["k"] * (actual - probability)
            updates[home] += delta
            updates[away] -= delta
        # No same-day result can affect another same-day forecast.
        for team, delta in updates.items():
            ratings[team] += delta
    return predictions


def metrics(probabilities, outcomes):
    pairs = list(zip(probabilities, outcomes))
    if not pairs:
        raise ValueError("Cannot evaluate an empty set")
    return dict(
        accuracy=sum((p >= 0.5) == bool(y) for p, y in pairs) / len(pairs),
        brier=sum((p - y) ** 2 for p, y in pairs) / len(pairs),
        log_loss=-sum(y * math.log(max(p, 1e-15)) + (1-y) * math.log(max(1-p, 1e-15))
                      for p, y in pairs) / len(pairs),
    )


def audit(games):
    summaries = {}
    for season in SEASONS:
        selected = [g for g in games if g["season"] == season]
        counts = Counter(team for g in selected for team in (g["home_team_id"], g["away_team_id"]))
        if len(selected) != 1230 or len(counts) != 30 or set(counts.values()) != {82}:
            raise ValueError(f"Incomplete {season}: expected 1,230 games and 82 appearances for each of 30 teams")
        if len({g["game_id"] for g in selected}) != len(selected):
            raise ValueError(f"Duplicate games in {season}")
        summaries[season] = dict(games=len(selected), teams=len(counts), games_per_team=82,
            neutral_games=sum(g["neutral_site"] for g in selected),
            first_date=min(g["game_date"] for g in selected), last_date=max(g["game_date"] for g in selected))
    return summaries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=DEFAULT_DB)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "data" / "backtest")
    args = parser.parse_args()
    if not args.database.exists():
        parser.error("Import all three seasons before evaluating")
    with sqlite3.connect(f"{args.database.resolve().as_uri()}?mode=ro", uri=True) as connection:
        connection.row_factory = sqlite3.Row
        games = [dict(r) for r in connection.execute(
            "SELECT * FROM games WHERE season_type='Regular Season' AND season IN (?, ?, ?) ORDER BY game_date, game_id", SEASONS)]
    coverage = audit(games)
    predictions = backtest(games)
    warmup = [r for r in predictions if r["season"] == SEASONS[0]]
    home_rate = sum(r["actual_home_win"] for r in warmup if not r["neutral_site"]) / sum(not r["neutral_site"] for r in warmup)
    results = {}
    for season in SEASONS[1:]:
        rows = [r for r in predictions if r["season"] == season]
        actual = [r["actual_home_win"] for r in rows]
        for row in rows:
            row["home_rate_baseline_probability"] = 0.5 if row["neutral_site"] else home_rate
        results[season] = dict(
            games=len(rows),
            elo=metrics([r["home_win_probability"] for r in rows], actual),
            home_rate_baseline=metrics([r["home_rate_baseline_probability"] for r in rows], actual),
            always_pick_designated_home_accuracy=sum(actual) / len(actual),
            coin_flip_brier=0.25,
        )
    digest = hashlib.sha256(json.dumps(games, sort_keys=True).encode()).hexdigest()
    report = dict(generated_at=datetime.now(timezone.utc).isoformat(), data_sha256=digest,
        parameters=PARAMETERS, warmup_season=SEASONS[0], development_season=SEASONS[1],
        test_season=SEASONS[2], coverage=coverage, home_rate_from_warmup=home_rate, results=results,
        protocol="Fixed parameters; predict before updating; updates after each date; ratings carry forward with offseason regression. No parameter tuning on either evaluation season.",
        limitations=["Historical backtest using current corrected records, not archived pregame snapshots.",
                     "Ratings update after prior test games; this evaluates daily sequential forecasting, not preseason forecasts.",
                     "No injuries, rosters, player projections, rest, margin-of-victory or playoff updates.",
                     "Neutral-site registry is manually maintained; home-court advantage is zero for listed games.",
                     "2025-26 has now been evaluated; repeated development against it would make it development data."])
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    fields = list(predictions[-1])
    with (args.output / "predictions.csv").open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(predictions)
    lines = ["# Initial Elo backtest", "", "Historical evaluation; not live predictions.", "",
             "2023-24 initializes ratings; 2024-25 is development; 2025-26 is the held-out evaluation.",
             "Parameters were fixed before evaluation: K=20, home advantage=65 Elo points, offseason retention=75%.", "",
             "| Season | Games | Elo accuracy | Home-pick accuracy | Elo Brier | Home-rate Brier | Elo log loss |",
             "|---|---:|---:|---:|---:|---:|---:|"]
    for season, result in results.items():
        e, b = result["elo"], result["home_rate_baseline"]
        lines.append(f"| {season} | {result['games']} | {e['accuracy']:.1%} | {result['always_pick_designated_home_accuracy']:.1%} | {e['brier']:.4f} | {b['brier']:.4f} | {e['log_loss']:.4f} |")
    lines += ["", "Brier score and log loss measure probability error; lower is better. A 50/50 prediction has Brier score 0.25.",
              "The home-rate baseline uses only 2023-24 results, with 50/50 for neutral games.", "",
              "All three seasons pass coverage checks: 1,230 games, 30 teams, 82 appearances per team.",
              "Predictions are saved before rating updates; all games on a date use ratings from earlier dates.", "",
              "## Limitations", ""] + [f"- {item}" for item in report["limitations"]]
    (args.output / "report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"\nSaved report.json, report.md and predictions.csv to {args.output.resolve()}")


if __name__ == "__main__":
    main()
