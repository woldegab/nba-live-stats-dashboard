"""Download completed NBA games and store validated records in SQLite."""

import argparse
from collections import defaultdict
from datetime import datetime
import json
from pathlib import Path
import re
import sqlite3
import sys
import time

DEFAULT_DB = Path(__file__).parent / "data" / "nba.sqlite3"
NEUTRAL_SITES = json.loads((Path(__file__).parent / "neutral_sites.json").read_text())


def season_value(value):
    if not re.fullmatch(r"\d{4}-\d{2}", value):
        raise argparse.ArgumentTypeError("Use a season such as 2025-26")
    if int(value[-2:]) != (int(value[:4]) + 1) % 100:
        raise argparse.ArgumentTypeError("Season years must be consecutive")
    return value


def fetch_rows(season, season_type, attempts=3, timeout=30):
    from nba_api.stats.endpoints import leaguegamelog
    from requests.exceptions import RequestException

    for attempt in range(attempts):
        try:
            response = leaguegamelog.LeagueGameLog(
                season=season,
                season_type_all_star=season_type,
                player_or_team_abbreviation="T",
                timeout=timeout,
            )
            return response.get_normalized_dict()["LeagueGameLog"]
        except (RequestException, ValueError, KeyError) as error:
            if attempt + 1 == attempts:
                raise RuntimeError(
                    "NBA data request failed; existing stored games were not changed. "
                    "Try again later or use --input with a saved team-log JSON file. "
                    f"Cause: {type(error).__name__}: {error}"
                ) from error
            delay = 5 * (2**attempt)
            print(f"Request failed ({type(error).__name__}); retrying in {delay}s", file=sys.stderr)
            time.sleep(delay)


def normalize_games(rows, season, season_type, skipped_venues=None):
    if not isinstance(rows, list) or not rows:
        raise ValueError("Expected a nonempty list of team game logs")
    grouped = defaultdict(list)
    expected_season_id = ("2" if season_type == "Regular Season" else "4") + season[:4]
    for row in rows:
        if str(row["SEASON_ID"]) != expected_season_id:
            raise ValueError("Source season does not match the requested season/type")
        grouped[str(row["GAME_ID"])].append(row)
    games = []
    for game_id, teams in grouped.items():
        if len(teams) != 2:
            raise ValueError(f"Game {game_id}: expected exactly two team records")
        home = [r for r in teams if " vs. " in r["MATCHUP"]]
        away = [r for r in teams if " @ " in r["MATCHUP"]]
        neutral = game_id in NEUTRAL_SITES
        if neutral:
            designated_home = NEUTRAL_SITES[game_id]["home"]
            home = [r for r in teams if r["TEAM_ABBREVIATION"] == designated_home]
            away = [r for r in teams if r["TEAM_ABBREVIATION"] != designated_home]
        if len(home) != 1 or len(away) != 1:
            if skipped_venues is not None:
                skipped_venues.append(game_id)
                continue
            raise ValueError(f"Game {game_id}: cannot identify home and away teams")
        home, away = home[0], away[0]
        dates = [datetime.fromisoformat(r["GAME_DATE"]).date().isoformat() for r in (home, away)]
        if dates[0] != dates[1] or home["TEAM_ID"] == away["TEAM_ID"]:
            raise ValueError(f"Game {game_id}: inconsistent teams or dates")
        scores = [r["PTS"] for r in (home, away)]
        if any(isinstance(p, bool) or not isinstance(p, int) or p < 0 for p in scores):
            raise ValueError(f"Game {game_id}: invalid final scores")
        if scores[0] == scores[1]:
            raise ValueError(f"Game {game_id}: tied or unfinished game")
        expected_results = ["W", "L"] if scores[0] > scores[1] else ["L", "W"]
        if [home["WL"], away["WL"]] != expected_results:
            raise ValueError(f"Game {game_id}: results disagree with scores")
        games.append((game_id, season, season_type, dates[0], int(home["TEAM_ID"]),
                      home["TEAM_ABBREVIATION"], int(away["TEAM_ID"]),
                      away["TEAM_ABBREVIATION"], *scores, int(neutral)))
    if not games:
        raise ValueError("No valid completed games remain")
    return sorted(games, key=lambda game: (game[3], game[0]))


def store_games(database, games):
    database = Path(database)
    database.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(database) as connection:
        connection.execute("""CREATE TABLE IF NOT EXISTS games (
            game_id TEXT PRIMARY KEY, season TEXT NOT NULL, season_type TEXT NOT NULL,
            game_date TEXT NOT NULL, home_team_id INTEGER NOT NULL,
            home_team TEXT NOT NULL, away_team_id INTEGER NOT NULL,
            away_team TEXT NOT NULL, home_score INTEGER NOT NULL,
            away_score INTEGER NOT NULL
        )""")
        columns = {row[1] for row in connection.execute("PRAGMA table_info(games)")}
        if "neutral_site" not in columns:
            connection.execute("ALTER TABLE games ADD COLUMN neutral_site INTEGER NOT NULL DEFAULT 0")
        before = connection.execute("SELECT COUNT(*) FROM games").fetchone()[0]
        connection.executemany("""INSERT INTO games
            (game_id, season, season_type, game_date, home_team_id, home_team,
             away_team_id, away_team, home_score, away_score, neutral_site)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(game_id) DO UPDATE SET
                season=excluded.season, season_type=excluded.season_type,
                game_date=excluded.game_date, home_team_id=excluded.home_team_id,
                home_team=excluded.home_team, away_team_id=excluded.away_team_id,
                away_team=excluded.away_team, home_score=excluded.home_score,
                away_score=excluded.away_score, neutral_site=excluded.neutral_site""", games)
        after = connection.execute("SELECT COUNT(*) FROM games").fetchone()[0]
    return after - before, after


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", required=True, type=season_value)
    parser.add_argument("--season-type", choices=["Regular Season", "Playoffs"], default="Regular Season")
    parser.add_argument("--database", type=Path, default=DEFAULT_DB)
    parser.add_argument("--input", type=Path, help="Read a saved JSON list of NBA team game logs")
    parser.add_argument("--raw-output", type=Path, help="Save source records for inspection and offline reruns")
    parser.add_argument("--skip-ambiguous-venues", action="store_true",
                        help="Exclude and report games without a unique home/away designation")
    parser.add_argument("--attempts", type=int, choices=range(1, 6), default=3)
    args = parser.parse_args()
    try:
        rows = json.loads(args.input.read_text()) if args.input else fetch_rows(
            args.season, args.season_type, args.attempts
        )
        if args.raw_output:
            args.raw_output.parent.mkdir(parents=True, exist_ok=True)
            args.raw_output.write_text(json.dumps(rows, indent=2) + "\n")
        skipped = [] if args.skip_ambiguous_venues else None
        games = normalize_games(rows, args.season, args.season_type, skipped)
        inserted, total = store_games(args.database, games)
    except (RuntimeError, ValueError, KeyError, TypeError, OSError, sqlite3.Error) as error:
        print(f"Import failed: {error}", file=sys.stderr)
        return 1
    print(f"Validated {len(games)} games ({games[0][3]} through {games[-1][3]}).")
    print(f"Inserted {inserted}; refreshed {len(games) - inserted}; database total {total}.")
    print(f"Database: {args.database.resolve()}")
    if skipped:
        print(f"Excluded {len(skipped)} games with ambiguous venues: {', '.join(skipped)}")
    print("Record validation does not certify that the source returned the entire season.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
