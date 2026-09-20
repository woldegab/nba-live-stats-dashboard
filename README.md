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
