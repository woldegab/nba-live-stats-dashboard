# NBA data and first prediction model

This backend collects historical NBA results and evaluates a simple team-win Elo
model. A read-only FastAPI service now connects saved predictions to React. Requires
Python 3.10+. No API key or paid subscription is needed.

## Setup and data collection

Run from the repository root:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python backend/import_games.py --season 2023-24 --raw-output backend/data/team_logs_2023_24.json
backend/.venv/bin/python backend/import_games.py --season 2024-25 --raw-output backend/data/team_logs_2024_25.json
backend/.venv/bin/python backend/import_games.py --season 2025-26 --raw-output backend/data/team_logs_2025_26.json
```

Run these sequentially. Each request retrieves one season of team logs. The
importer validates paired records and writes one row per completed game to
`backend/data/nba.sqlite3`. Rerunning updates games without duplicates. Playoffs
can be imported with `--season-type Playoffs`, but the initial model evaluates
regular-season games only.

Raw JSON snapshots allow offline reproduction. For example:

```sh
backend/.venv/bin/python backend/import_games.py --season 2025-26 --input backend/data/team_logs_2025_26.json
```

Requests have a 30-second timeout, up to three attempts, and increasing retry
delays. Failed fetching/validation leaves stored games intact. Unknown ambiguous
home/away records fail validation by default; `--skip-ambiguous-venues` explicitly
excludes and reports them. Do not use that option for the complete backtest.

## Neutral venues and data quality

The first import excluded five 2025-26 games because both teams were marked away.
Investigation identified these as Mexico City, Berlin, London, and the two Las
Vegas NBA Cup semifinal games. All five are now included. The same issue affected
five 2024-25 games; those have also been restored. Four known neutral games in
2023-24 had ordinary home/away labels and were explicitly marked neutral too.

`neutral_sites.json` records the designated home team and official NBA source
links for 14 games across the three seasons. Each game can also be reviewed at
`https://www.nba.com/game/<game_id>`. Designated home is a bookkeeping label;
the model applies zero home-court advantage to these games. This registry needs
maintenance as seasons are added. Existing databases automatically receive the
`neutral_site` column without deleting games; reimport snapshots to apply flags.

Each of the three imported seasons passes checks for 1,230 distinct games, 30
teams, and 82 games per team. Coverage checks do not independently prove every
score is correct. Player logs have not yet been tested.

## Run the historical backtest

```sh
backend/.venv/bin/python backend/evaluate_elo.py
```

Elo assigns each team a strength rating. Before each game, the model compares the
two ratings and adds a home-court adjustment when appropriate. After the date's
games finish, winners gain rating points and losers lose them. Unexpected wins
produce larger adjustments. Parameters were fixed before viewing evaluation
results: initial rating 1,500; update factor K=20; home advantage 65 Elo points;
offseason retention 75% of the previous rating's distance from 1,500.

- **2023-24:** initialize ratings; estimate the constant home-win-rate baseline.
- **2024-25:** development evaluation. No parameter search was performed.
- **2025-26:** initial held-out evaluation using the same settings.

Every prediction uses ratings from earlier dates only. Same-day results cannot
affect each other. Outcomes update ratings after predictions, including during
the evaluation seasons: this simulates daily forecasting rather than predicting
an entire season before it starts. The evaluator refuses incomplete coverage.

Outputs in `backend/data/backtest/`:

- `predictions.csv`: per-game pregame ratings/probabilities and actual outcomes.
- `report.json`: parameters, coverage, metrics, timestamp and input-data hash.
- `report.md`: readable evaluation summary.

The checked-in `BASELINE_RESULTS.md` captures the first run. Accuracy measures
winner selection; Brier score and log loss measure probability error (lower is
better). Compare against always selecting the designated home team and against
a constant home-win probability learned from 2023-24 (50/50 at neutral venues).

## Verification

```sh
backend/.venv/bin/python -m unittest discover -s backend -p 'test_*.py'
```

Tests use synthetic records and temporary databases. They cover duplicate
prevention, score corrections, season/result validation, neutral handling,
legacy database migration, past/future separation, same-day isolation,
offseason regression and metric calculations.

## Limits and next step

This is a historical backtest using current corrected data, not predictions
recorded before the real games. No injuries, roster changes, player projections,
rest features, playoff results, or scoring margins enter this first model.
2025-26 has now been inspected: repeatedly tuning against it would invalidate
its role as an untouched test. Use development data for changes and collect
future predictions prospectively for a new evaluation.

Run the API with `backend/.venv/bin/python -m uvicorn api:app --app-dir backend --host 127.0.0.1 --port 8000`.
See the [root README](../README.md) for the dashboard setup and API endpoints.
The service reads a saved snapshot at startup; restart it after regenerating the backtest.
Data, databases and Python environments are excluded from
Git. The package license covers its code; NBA data has separate terms.
