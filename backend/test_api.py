import csv
import json
from pathlib import Path
import tempfile
import unittest

from fastapi.testclient import TestClient
from api import create_app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name)
        self.report = dict(generated_at='2026-09-20T00:00:00Z', warmup_season='2023-24',
            test_season='2025-26', coverage={'2025-26': {'games': 1}},
            results={'2025-26': {'elo': {'accuracy': 1.0}}})
        (self.path / 'report.json').write_text(json.dumps(self.report))
        self.row = dict(game_id='example', season='2025-26', game_date='2026-01-15',
            home_team='AAA', away_team='BBB', neutral_site=1, home_rating=1520,
            away_rating=1480, home_win_probability=0.6, actual_home_win=1,
            home_score=110, away_score=100)
        self.write_row()

    def write_row(self):
        with (self.path / 'predictions.csv').open('w', newline='') as file:
            writer = csv.DictWriter(file, fieldnames=self.row.keys())
            writer.writeheader()
            writer.writerow(self.row)

    def test_game_response_preserves_prediction_and_result(self):
        with TestClient(create_app(self.path)) as client:
            response = client.get('/api/games?date=2026-01-15')
            self.assertEqual(response.status_code, 200)
            game = response.json()['games'][0]
            self.assertEqual(game['home_win_probability'], 0.6)
            self.assertEqual(game['away_win_probability'], 0.4)
            self.assertTrue(game['neutral_site'])
            self.assertTrue(game['correct'])
            self.assertEqual(game['predicted_winner'], 'AAA')
            self.assertEqual(game['home_score'], 110)

    def test_metadata_and_metrics_match_artifact(self):
        with TestClient(create_app(self.path)) as client:
            season = client.get('/api/seasons').json()['seasons'][0]
            self.assertEqual(season['dates'], ['2026-01-15'])
            self.assertEqual(season['phase'], 'Initial test')
            self.assertEqual(client.get('/api/model-performance').json(), self.report)

    def test_empty_date_and_bad_date(self):
        with TestClient(create_app(self.path)) as client:
            self.assertEqual(client.get('/api/games?date=2026-01-16').json()['games'], [])
            self.assertEqual(client.get('/api/games?date=invalid').status_code, 422)
            self.assertEqual(client.get('/api/games').status_code, 422)

    def test_missing_artifacts_return_actionable_error(self):
        with TestClient(create_app(self.path / 'missing')) as client:
            response = client.get('/api/seasons')
            self.assertEqual(response.status_code, 503)
            self.assertIn('evaluate_elo.py', response.json()['detail'])

    def test_invalid_predictions_are_not_served(self):
        self.row['home_win_probability'] = 'nan'
        self.write_row()
        with TestClient(create_app(self.path)) as client:
            self.assertEqual(client.get('/api/seasons').status_code, 503)

    def test_mismatched_coverage_is_not_served(self):
        self.report['coverage']['2025-26']['games'] = 2
        (self.path / 'report.json').write_text(json.dumps(self.report))
        with TestClient(create_app(self.path)) as client:
            self.assertEqual(client.get('/api/seasons').status_code, 503)


if __name__ == '__main__':
    unittest.main()
