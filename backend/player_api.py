"""Player browsing over locally imported appearances."""
from contextlib import contextmanager
from pathlib import Path
import sqlite3

from fastapi import APIRouter, HTTPException
from typing import Literal
from import_games import DEFAULT_DB
from points_api import projection


def player_router(database=DEFAULT_DB):
    router = APIRouter()

    @contextmanager
    def connect():
        if not Path(database).exists():
            raise HTTPException(503, 'Player data has not been imported yet.')
        db = sqlite3.connect(f'{Path(database).resolve().as_uri()}?mode=ro', uri=True)
        db.row_factory = sqlite3.Row
        try:
            if not db.execute("SELECT 1 FROM sqlite_master WHERE name='player_games'").fetchone():
                raise HTTPException(503, 'Import player logs with backend/import_players.py first.')
            yield db
        finally:
            db.close()

    @router.get('/api/players')
    def players(season: str | None = None, window: Literal['5', '10', 'season'] = '10'):
        with connect() as db:
            seasons = [row[0] for row in db.execute('SELECT DISTINCT season FROM player_games ORDER BY season DESC')]
            chosen = season or (seasons[0] if seasons else None)
            if chosen not in seasons:
                raise HTTPException(404, 'No player data for this season')
            rows = db.execute('''WITH ranked AS (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date DESC, game_id DESC) AS rank
                FROM player_games WHERE season=?)
                SELECT player_id, MAX(CASE WHEN rank=1 THEN player_name END) AS name,
                MAX(CASE WHEN rank=1 THEN team END) AS team,
                MAX(game_date) AS last_game_date, COUNT(*) AS sample_games,
                AVG(points) AS points, AVG(rebounds) AS rebounds, AVG(assists) AS assists,
                AVG(minutes) AS minutes FROM ranked WHERE (?='season' OR rank<=CAST(? AS INTEGER))
                GROUP BY player_id ORDER BY name COLLATE NOCASE''', (chosen, window, window)).fetchall()
            return dict(season=chosen, seasons=seasons, window=window, players=[dict(row) for row in rows])

    @router.get('/api/players/{player_id}')
    def detail(player_id: int, season: str, window: Literal['5', '10', 'season'] = '10'):
        with connect() as db:
            rows = [dict(row) for row in db.execute('''SELECT * FROM player_games
                WHERE player_id=? AND season=? ORDER BY game_date DESC, game_id DESC LIMIT ?''', (player_id, season, -1 if window == 'season' else int(window)))]
            if not rows:
                raise HTTPException(404, 'No appearances found for this player and season')
            return dict(player_id=player_id, name=rows[0]['player_name'], team=rows[0]['team'],
                season=season, window=window, games=rows, sample_games=len(rows),
                averages={field: sum(row[field] for row in rows)/len(rows) for field in ('points','rebounds','assists','minutes')})

    def matchup_game(db, game_id):
        if not db.execute("SELECT 1 FROM sqlite_master WHERE name='games'").fetchone():
            raise HTTPException(503, 'Import team game data first')
        game = db.execute('SELECT * FROM games WHERE game_id=?', (game_id,)).fetchone()
        if not game:
            raise HTTPException(404, 'Game not found')
        return dict(game_id=game['game_id'], season=game['season'], date=game['game_date'],
                    home_team=game['home_team'], away_team=game['away_team'])

    def averages(rows):
        return {field: sum(row[field] for row in rows) / len(rows) if rows else None
                for field in ('points', 'rebounds', 'assists', 'minutes')}

    @router.get('/api/matchups/{game_id}')
    def matchup(game_id: str):
        with connect() as db:
            game = matchup_game(db, game_id)
            participants = [dict(row) for row in db.execute(
                'SELECT player_id, player_name AS name, team FROM player_games WHERE game_id=? ORDER BY team, player_name',
                (game_id,))]
            return dict(game=game, players=participants,
                        participant_basis='Actual recorded participants, not a pregame roster or availability forecast')

    @router.get('/api/matchups/{game_id}/players/{player_id}')
    def pregame(game_id: str, player_id: int, window: Literal['5', '10', 'season'] = '10'):
        with connect() as db:
            game = matchup_game(db, game_id)
            player = db.execute('SELECT player_name, team, points FROM player_games WHERE game_id=? AND player_id=?',
                                (game_id, player_id)).fetchone()
            if not player:
                raise HTTPException(404, 'No recorded appearance for this player in this game')
            if player['team'] not in (game['home_team'], game['away_team']):
                raise HTTPException(409, 'Player and team game records disagree')
            opponent = game['away_team'] if player['team'] == game['home_team'] else game['home_team']
            # Strict date cutoff excludes the selected game, other same-day games, and future games.
            history = [dict(row) for row in db.execute(
                'SELECT * FROM player_games WHERE player_id=? AND season=? AND game_date<? ORDER BY game_date DESC, game_id DESC',
                (player_id, game['season'], game['date']))]
            selected = history if window == 'season' else history[:int(window)]
            versus = [row for row in history if row['matchup'].split()[-1] == opponent]
            return dict(game=game, player_id=player_id, name=player['player_name'], team=player['team'],
                        opponent=opponent, window=window, games=selected, sample_games=len(selected),
                        averages=averages(selected), opponent_games=versus,
                        opponent_sample_games=len(versus), opponent_averages=averages(versus),
                        actual_points=player['points'], historical_only=True, projection=projection(game_id, player_id))

    return router
