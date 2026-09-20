import unittest

from evaluate_elo import backtest, metrics


def game(game_id, date, home_score=110, away_score=100, neutral=0):
    return dict(game_id=game_id, game_date=date, season='2023-24', home_team_id=1,
                away_team_id=2, home_team='AAA', away_team='BBB',
                home_score=home_score, away_score=away_score, neutral_site=neutral)


class EloTests(unittest.TestCase):
    def test_current_and_future_results_do_not_change_pregame_forecast(self):
        first = game('1', '2023-10-24')
        second = game('2', '2023-10-25')
        original = backtest([first, second])
        second['home_score'] = 80
        changed = backtest([first, second])
        self.assertEqual([r['home_win_probability'] for r in original],
                         [r['home_win_probability'] for r in changed])
        self.assertEqual(backtest([first])[0]['home_win_probability'], original[0]['home_win_probability'])

    def test_previous_results_affect_next_date(self):
        rows = backtest([game('1', '2023-10-24'), game('2', '2023-10-25')])
        self.assertGreater(rows[1]['home_win_probability'], rows[0]['home_win_probability'])

    def test_same_day_results_are_not_used(self):
        rows = backtest([game('1', '2023-10-24'), game('2', '2023-10-24')])
        self.assertEqual(rows[0]['home_win_probability'], rows[1]['home_win_probability'])

    def test_neutral_equal_teams_are_even(self):
        self.assertEqual(backtest([game('1', '2023-10-24', neutral=1)])[0]['home_win_probability'], 0.5)

    def test_offseason_regression(self):
        second = game('2', '2024-10-24')
        second['season'] = '2024-25'
        row = backtest([game('1', '2023-10-24', neutral=1), second])[1]
        self.assertEqual(row['home_rating'], 1507.5)
        self.assertEqual(row['away_rating'], 1492.5)

    def test_probability_metrics(self):
        result = metrics([0.5, 0.5], [0, 1])
        self.assertEqual(result['brier'], 0.25)
        self.assertAlmostEqual(result['log_loss'], 0.69314718)


if __name__ == '__main__':
    unittest.main()
