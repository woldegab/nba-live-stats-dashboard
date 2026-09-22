"""Import season player appearances. DNPs are not inferred as zero-point games."""
import argparse
from datetime import datetime
import json
import math
from pathlib import Path
import sqlite3
import time

from import_games import DEFAULT_DB, season_value


def normalize(rows, season):
    if not isinstance(rows, list) or not rows:
        raise ValueError('Expected nonempty player logs')
    records, seen = [], set()
    for row in rows:
        key = (str(row['GAME_ID']), int(row['PLAYER_ID']))
        if key in seen:
            raise ValueError(f'Duplicate appearance {key}')
        seen.add(key)
        if str(row['SEASON_ID']) != '2' + season[:4]:
            raise ValueError('Wrong season or season type')
        stats = [float(row[field]) for field in ('MIN', 'PTS', 'REB', 'AST')]
        if any(not math.isfinite(value) or value < 0 for value in stats):
            raise ValueError('Invalid player statistics')
        if any(value != int(value) for value in stats[1:]):
            raise ValueError('Counting stats must be integers')
        records.append((*key, season, datetime.fromisoformat(row['GAME_DATE']).date().isoformat(),
            row['PLAYER_NAME'], row['TEAM_ABBREVIATION'], row['MATCHUP'], row['WL'],
            stats[0], *map(int, stats[1:])))
    return records


def store(records, database):
    database.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(database) as db:
        db.execute('''CREATE TABLE IF NOT EXISTS player_games (
            game_id TEXT, player_id INTEGER, season TEXT, game_date TEXT,
            player_name TEXT, team TEXT, matchup TEXT, result TEXT,
            minutes REAL, points INTEGER, rebounds INTEGER, assists INTEGER,
            PRIMARY KEY(game_id, player_id))''')
        db.executemany('''INSERT INTO player_games VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(game_id, player_id) DO UPDATE SET
            season=excluded.season, game_date=excluded.game_date, player_name=excluded.player_name,
            team=excluded.team, matchup=excluded.matchup, result=excluded.result,
            minutes=excluded.minutes, points=excluded.points, rebounds=excluded.rebounds, assists=excluded.assists''', records)
        db.execute('CREATE INDEX IF NOT EXISTS player_season_date ON player_games(season, player_id, game_date)')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--season', required=True, type=season_value)
    parser.add_argument('--input', type=Path)
    parser.add_argument('--database', type=Path, default=DEFAULT_DB)
    args = parser.parse_args()
    if args.input:
        rows = json.loads(args.input.read_text())
    else:
        from nba_api.stats.endpoints.leaguegamelog import LeagueGameLog
        from requests.exceptions import RequestException
        for attempt in range(3):
            try:
                rows = LeagueGameLog(season=args.season, player_or_team_abbreviation='P',
                    season_type_all_star='Regular Season', timeout=30).get_normalized_dict()['LeagueGameLog']
                break
            except (RequestException, ValueError, KeyError):
                if attempt == 2:
                    raise
                time.sleep(5 * (attempt + 1))
        raw = args.database.parent / f'player_logs_{args.season}.json'
        raw.parent.mkdir(parents=True, exist_ok=True)
        raw.write_text(json.dumps(rows))
    records = normalize(rows, args.season)
    store(records, args.database)
    print(f'Stored {len(records)} appearances for {len({r[1] for r in records})} players in {args.season}.')


if __name__ == '__main__':
    main()
