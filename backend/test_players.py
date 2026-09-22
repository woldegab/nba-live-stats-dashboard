from pathlib import Path
import sqlite3
import tempfile
import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from import_players import normalize, store
from player_api import player_router


class PlayerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Path(self.temp.name) / 'nba.sqlite3'
        self.rows = [dict(SEASON_ID='22025', GAME_ID=str(i), PLAYER_ID=1,
            GAME_DATE=f'2026-01-{i:02}', PLAYER_NAME='Example Player', TEAM_ABBREVIATION='BOS',
            MATCHUP='BOS vs. NYK', WL='W', MIN=30, PTS=i, REB=5, AST=4) for i in range(1, 13)]
        store(normalize(self.rows, '2025-26'), self.db)
        app = FastAPI()
        app.include_router(player_router(self.db))
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_latest_ten_and_summary_agree(self):
        detail = self.client.get('/api/players/1?season=2025-26').json()
        self.assertEqual([g['points'] for g in detail['games']], list(range(12,2,-1)))
        self.assertEqual(detail['averages']['points'], 7.5)
        summary = self.client.get('/api/players').json()['players'][0]
        self.assertEqual(summary['points'], detail['averages']['points'])
        self.assertEqual(summary['sample_games'], 10)

    def test_player_windows_match_list_and_detail(self):
        for window, count, average in [('5',5,10),('10',10,7.5),('season',12,6.5)]:
            detail = self.client.get(f'/api/players/1?season=2025-26&window={window}').json()
            summary = self.client.get(f'/api/players?window={window}').json()['players'][0]
            self.assertEqual(detail['sample_games'],count)
            self.assertEqual(detail['averages']['points'],average)
            self.assertEqual(summary['points'],average)
        self.assertEqual(self.client.get('/api/players?window=100').status_code,422)

    def test_reimport_does_not_duplicate(self):
        store(normalize(self.rows, '2025-26'), self.db)
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM player_games').fetchone()[0],12)

    def test_small_sample_and_historical_team(self):
        row = dict(self.rows[0], PLAYER_ID=2, TEAM_ABBREVIATION='LAL', PTS=25)
        store(normalize([row], '2025-26'), self.db)
        result = self.client.get('/api/players/2?season=2025-26').json()
        self.assertEqual(result['sample_games'],1)
        self.assertEqual(result['averages']['points'],25)
        self.assertEqual(result['team'],'LAL')

    def test_invalid_import(self):
        for change in [dict(SEASON_ID='22024'), dict(PTS=-1), dict(MIN=float('nan'))]:
            with self.assertRaises(ValueError):
                normalize([dict(self.rows[0], **change)], '2025-26')
        with self.assertRaises(ValueError):
            normalize([self.rows[0],self.rows[0]], '2025-26')

    def add_matchup(self, game_id='10', date='2026-01-10'):
        with sqlite3.connect(self.db) as db:
            db.execute('CREATE TABLE IF NOT EXISTS games (game_id TEXT, season TEXT, game_date TEXT, home_team TEXT, away_team TEXT)')
            db.execute('INSERT INTO games VALUES (?,?,?,?,?)', (game_id,'2025-26',date,'BOS','NYK'))

    def test_pregame_windows_and_cutoff(self):
        self.add_matchup()
        base = '/api/matchups/10/players/1'
        all_games = self.client.get(base+'?window=season').json()
        self.assertEqual(all_games['sample_games'], 9)
        self.assertTrue(all(g['game_date'] < '2026-01-10' for g in all_games['games']))
        self.assertEqual(all_games['opponent_sample_games'], 9)
        recent = self.client.get(base+'?window=5').json()
        self.assertEqual([g['points'] for g in recent['games']], [9,8,7,6,5])
        self.assertEqual(recent['averages']['points'],7)
        self.assertEqual(recent['opponent_sample_games'],9)
        self.assertEqual(self.client.get(base+'?window=30').status_code,422)
        # Changing selected-game and future outcomes cannot affect the analysis.
        with sqlite3.connect(self.db) as db:
            db.execute("UPDATE player_games SET points=999 WHERE game_date>='2026-01-10'")
        changed = self.client.get(base+'?window=season').json()
        self.assertEqual(changed.pop('actual_points'), 999)
        self.assertEqual(all_games.pop('actual_points'), 10)
        self.assertEqual(changed, all_games)

    def test_opening_game_has_missing_not_zero_averages(self):
        self.add_matchup('1','2026-01-01')
        result = self.client.get('/api/matchups/1/players/1').json()
        self.assertEqual(result['sample_games'],0)
        self.assertIsNone(result['averages']['points'])
        self.assertEqual(result['opponent_games'],[])

    def test_participants_do_not_expose_selected_game_statistics(self):
        self.add_matchup()
        result = self.client.get('/api/matchups/10').json()
        self.assertEqual(result['players'],[dict(player_id=1,name='Example Player',team='BOS')])
        self.assertNotIn('home_score',result['game'])
        self.assertEqual(self.client.get('/api/matchups/10/players/99').status_code,404)

    def test_missing_player_or_season(self):
        self.assertEqual(self.client.get('/api/players/999?season=2025-26').status_code,404)
        self.assertEqual(self.client.get('/api/players?season=2000-01').status_code,404)


if __name__ == '__main__':
    unittest.main()
