from copy import deepcopy
import unittest
from evaluate_points import examples, metrics


class PointsTests(unittest.TestCase):
    def data(self):
        players = [dict(game_id=str(i),player_id=1,season='2025-26',game_date=f'2025-12-{i:02}',
                        points=i,minutes=20,matchup='BOS vs. NYK') for i in range(1,9)]
        games = [dict(game_id=str(i),season='2025-26',game_date=f'2025-12-{i:02}',
                      home_team='BOS',away_team='NYK',home_score=100+i,away_score=90) for i in range(1,9)]
        return players,games

    def test_minimum_history_and_baseline(self):
        rows = examples(*self.data())
        self.assertEqual(rows[0]['game_id'],'6')
        self.assertEqual(rows[0]['baseline'],3)
        self.assertEqual(rows[0]['features'][1],20)
        self.assertEqual(rows[0]['features'][4],103)

    def test_future_and_same_day_outcomes_do_not_change_features(self):
        players,games=self.data()
        original=examples(players,games)
        modified_players,modified_games=deepcopy(players),deepcopy(games)
        for row in modified_players:
            if row['game_date']>='2025-12-06':
                row['points']=500
                row['minutes']=100
        for row in modified_games:
            if row['game_date']>='2025-12-06':
                row['home_score']=500
        changed=examples(modified_players,modified_games)
        self.assertEqual(original[0]['features'],changed[0]['features'])
        self.assertEqual(original[0]['baseline'],changed[0]['baseline'])
        self.assertEqual(examples(players[:6],games[:6])[0]['features'],original[0]['features'])

    def test_error_metrics(self):
        result=metrics([dict(actual=10,baseline=8),dict(actual=20,baseline=24)],'baseline')
        self.assertEqual(result['mae'],3)
        self.assertAlmostEqual(result['rmse'],10**0.5)
