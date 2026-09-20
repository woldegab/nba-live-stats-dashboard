import tempfile
from pathlib import Path
import sqlite3
import unittest

from import_games import normalize_games, store_games


def sample_rows():
    # Synthetic records used only to test data integrity, never as training data.
    base = dict(SEASON_ID="22025", GAME_ID="0022500001", GAME_DATE="2025-10-22")
    return [
        dict(base, TEAM_ID=1, TEAM_ABBREVIATION="AAA", MATCHUP="AAA vs. BBB", PTS=110, WL="W"),
        dict(base, TEAM_ID=2, TEAM_ABBREVIATION="BBB", MATCHUP="BBB @ AAA", PTS=100, WL="L"),
    ]


class ImportTests(unittest.TestCase):
    def test_verified_neutral_site_retains_both_team_scores(self):
        rows = sample_rows()
        for row in rows:
            row["GAME_ID"] = "0022500147"
            row["GAME_DATE"] = "2025-11-01"
        rows[0].update(TEAM_ABBREVIATION="DET", MATCHUP="DET @ DAL")
        rows[1].update(TEAM_ABBREVIATION="DAL", MATCHUP="DAL @ DET")
        result = normalize_games(rows, "2025-26", "Regular Season")[0]
        self.assertEqual(result[5], "DET")
        self.assertEqual(result[7], "DAL")
        self.assertEqual(result[8:], (110, 100, 1))

    def test_legacy_database_migration_preserves_existing_games(self):
        with tempfile.TemporaryDirectory() as folder:
            database = Path(folder) / "games.sqlite3"
            with sqlite3.connect(database) as connection:
                connection.execute("""CREATE TABLE games (
                    game_id TEXT PRIMARY KEY, season TEXT, season_type TEXT, game_date TEXT,
                    home_team_id INTEGER, home_team TEXT, away_team_id INTEGER, away_team TEXT,
                    home_score INTEGER, away_score INTEGER)""")
                connection.execute("INSERT INTO games VALUES ('old', '2022-23', 'Regular Season', '2022-11-01', 1, 'AAA', 2, 'BBB', 110, 100)")
            store_games(database, normalize_games(sample_rows(), "2025-26", "Regular Season"))
            with sqlite3.connect(database) as connection:
                self.assertEqual(connection.execute("SELECT COUNT(*) FROM games").fetchone()[0], 2)
                self.assertEqual(connection.execute("SELECT neutral_site FROM games WHERE game_id='old'").fetchone()[0], 0)

    def test_reimport_and_score_correction(self):
        with tempfile.TemporaryDirectory() as folder:
            database = Path(folder) / "games.sqlite3"
            rows = sample_rows()
            games = normalize_games(rows, "2025-26", "Regular Season")
            self.assertEqual(store_games(database, games), (1, 1))
            self.assertEqual(store_games(database, games), (0, 1))
            rows[0]["PTS"] = 111
            store_games(database, normalize_games(rows, "2025-26", "Regular Season"))
            with sqlite3.connect(database) as connection:
                self.assertEqual(connection.execute("SELECT home_score FROM games").fetchone()[0], 111)

    def test_reject_incomplete_game(self):
        with self.assertRaises(ValueError):
            normalize_games(sample_rows()[:1], "2025-26", "Regular Season")

    def test_reject_wrong_season(self):
        with self.assertRaises(ValueError):
            normalize_games(sample_rows(), "2024-25", "Regular Season")

    def test_reject_inconsistent_result(self):
        rows = sample_rows()
        rows[0]["WL"] = "L"
        with self.assertRaises(ValueError):
            normalize_games(rows, "2025-26", "Regular Season")

    def test_ambiguous_venue_requires_explicit_exclusion(self):
        ambiguous = sample_rows()
        for row in ambiguous:
            row["GAME_ID"] = "0022500002"
        ambiguous[0]["MATCHUP"] = "AAA @ BBB"
        rows = sample_rows() + ambiguous
        with self.assertRaises(ValueError):
            normalize_games(rows, "2025-26", "Regular Season")
        skipped = []
        games = normalize_games(rows, "2025-26", "Regular Season", skipped)
        self.assertEqual(len(games), 1)
        self.assertEqual(skipped, ["0022500002"])


if __name__ == "__main__":
    unittest.main()
