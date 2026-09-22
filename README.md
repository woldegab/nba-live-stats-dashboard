# NBA Forecast Lab

A React dashboard for exploring historical NBA win probabilities and evaluating
an Elo baseline. Includes 2023-24 warm-up, 2024-25 development, and 2025-26 initial
test seasons. These are historical backtests, not live predictions.

## Run locally

Requires Python 3.10+ and a Node version supported by Vite 8 (20.19+ or 22.12+).
First install dependencies:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix client ci
```

If the saved data is not present, follow [the data setup](backend/README.md) to
import all three seasons, then generate the prediction artifacts:

```sh
backend/.venv/bin/python backend/evaluate_elo.py
```

Start the Python API in one terminal, from the repository root:

```sh
backend/.venv/bin/python -m uvicorn api:app --app-dir backend --host 127.0.0.1 --port 8000
```

Start React in a second terminal:

```sh
npm --prefix client run dev -- --port 5173 --strictPort
```

Open **http://127.0.0.1:5173**. API documentation is available at
http://127.0.0.1:8000/docs. Stop either server with Ctrl+C in its terminal.

## What you can explore

- Select any archived season and date; arrows move between dates with games.
- Compare each team's win probability with the final result.
- Expand a game to inspect pregame Elo ratings and venue treatment.
- Compare Elo accuracy and probability error with the home-team baseline.
- Review methodology and limitations; the warm-up season has no evaluation metrics.

React requests `/api/*`; Vite proxies these requests to the Python API. The API
loads `backend/data/backtest/predictions.csv` and `report.json` into a read-only
snapshot at startup. Page visits make no requests to NBA.com or BALLDONTLIE.
Restart the API after regenerating artifacts. Missing/invalid artifacts produce
an actionable HTTP 503 rather than fabricated predictions.

| Endpoint | Response |
|---|---|
| `GET /api/seasons` | Available seasons, game dates, counts and evaluation phase |
| `GET /api/games?date=2026-01-15` | Saved probabilities, ratings, scores and correctness |
| `GET /api/model-performance` | Original report, metrics, settings and limitations |

An empty date returns an empty game list. Missing or invalid date parameters
return HTTP 422. Local API paths are fixed; callers cannot choose files to read.

## Checks

```sh
backend/.venv/bin/python -m unittest discover -s backend -p 'test_*.py'
npm --prefix client run lint
npm --prefix client run build
```

For deployment, serve `/api` through the same origin or configure an appropriate
reverse proxy. The Vite proxy is a local development/preview convenience; static
hosting alone will not run the Python service. No deployment has been configured.

See [model documentation](backend/README.md) and [first evaluation results](backend/BASELINE_RESULTS.md).

## Player explorer

Import historical player appearances (no paid API key):

```sh
backend/.venv/bin/python backend/import_players.py --season 2025-26
```

The importer validates the full response before storing records in the
`player_games` SQLite table. Reimports update existing appearances. The original
response is saved as `backend/data/player_logs_2025-26.json`; rerun offline with
`--input backend/data/player_logs_2025-26.json`.

The app opens on **Players**. Search by name or filter by the team at each player's
latest appearance. Select a card to see up to ten recent games, their averages,
and a scoring chart. These are season-ending historical statistics, not current
rosters or pregame projections. Missed games are not filled in with zeros.
Player statistics are not used in Elo predictions yet.

- `GET /api/players?season=2025-26` returns available seasons and player summaries.
- `GET /api/players/{player_id}?season=2025-26` returns the ten latest appearances.

Player endpoints read SQLite on each request; restart an older API process once
to load the new routes. The initial import contains 26,651 appearances for 582
players. This count describes the source response, not an independent completeness
guarantee. Team and player data remain local and excluded from Git.

## Historical player matchups

Under **Game predictions**, choose a date in 2025–26 and click **Explore player
matchups**. Select an actual game participant to explore Last 5, Last 10, or
season-to-date statistics. The roster is identified from postgame appearances;
it is not an archived pregame lineup or availability prediction.

All analysis rows satisfy `game_date < selected_game_date` within the selected
season. This excludes the selected game, other games on its date, and future
results. Previous meetings with the opponent use all earlier appearances in that
season and display their own sample size. No-history averages are null (shown
as a dash), never zero. These statistics are descriptive, not player projections.
Earlier team seasons remain browsable but show an unavailable-player-data state
until their player logs are imported.

- `GET /api/matchups/{game_id}` returns actual participant identities without game scores.
- `GET /api/matchups/{game_id}/players/{player_id}?window=5` returns pregame history.
  Supported windows: `5`, `10`, `season` (default `10`).

## Initial player-points baseline

Generate the local projection artifact after importing player and team logs:

```sh
backend/.venv/bin/python backend/evaluate_points.py
```

The fixed baseline averages up to ten earlier player appearances and requires at
least five. A ridge-regression challenger (penalty 1, standardized inputs) uses
recent points, minutes, scoring rate, rest and opponent team points allowed.
No selected-game or same-day outcomes enter either model's inputs.

Chronological 2025–26 protocol: train before January 1; select using January 1–15
MAE; calibrate a pooled nominal 80% error range using January 16–31; test from
February 1 onward. The baseline won development selection and remains the served
model even though the challenger was slightly better on the test period. We do
not select models using test results. Before January 16 only the baseline is
eligible; calibrated ranges are available only from February 1. Intervals are
pooled across players and are approximate, not individual guarantees.

See [the measured results](backend/PLAYER_POINTS_RESULTS.md). Projections are
conditional on actually appearing; availability, injuries and roster forecasts
are not modeled. The test period has now been evaluated and should not be reused
for tuning. `backend/data/player_points.json` stores the parameters, provenance,
metrics and historical projections. Regenerate it after changing source data.

Open a game, choose **Explore player matchups**, and select a player to see the
points projection. Changing the history window changes descriptive statistics,
not the fixed ten-game prediction baseline. The general Players page and player
detail pages now support Last 5 / Last 10 / Full season via a `window` query
parameter (`5`, `10`, or `season`) on both player endpoints.

Completed player matchups now show projected points, actual points, and
`actual − projected` by default, including whether the outcome falls inside an
available estimated range. The existing **Show results** setting carries from
the game slate into participant and player views, and can be changed there.
Replay mode hides actual points, differences, and range-hit information together.
Actual points are returned separately from pregame history and never enter the
projection calculation. If no projection exists, the actual score is still shown.
