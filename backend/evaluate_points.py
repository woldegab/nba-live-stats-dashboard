"""Chronological player-points benchmark, fixed regression challenger and held-out evaluation."""
from collections import defaultdict
from datetime import date
from itertools import groupby
from pathlib import Path
import hashlib
import json
import math
import sqlite3

import numpy as np
from import_games import DEFAULT_DB

OUTPUT = Path(__file__).parent / 'data' / 'player_points.json'
FEATURES = ['points_last10', 'minutes_last5', 'points_per_minute_last10', 'rest_days_capped7', 'opponent_points_allowed_last10']
TRAIN_END = '2026-01-01'
DEVELOPMENT_END = '2026-01-16'
CALIBRATION_END = '2026-02-01'


def examples(players, games):
    histories = defaultdict(list)
    defense = defaultdict(list)
    team_days = defaultdict(list)
    for game in games:
        team_days[game['game_date']].append(game)
    player_days = defaultdict(list)
    for row in players:
        player_days[row['game_date']].append(row)
    output = []
    for day in sorted(set(team_days) | set(player_days)):
        for row in player_days[day]:
            history = histories[(row['season'], row['player_id'])]
            if len(history) < 5:
                continue
            recent = history[-10:]
            minutes = sum(g['minutes'] for g in recent)
            if minutes <= 0:
                continue
            opponent = row['matchup'].split()[-1]
            allowed = defense[(row['season'], opponent)][-10:]
            if not allowed:
                continue
            baseline = sum(g['points'] for g in recent) / len(recent)
            features = [baseline, sum(g['minutes'] for g in history[-5:])/5,
                        sum(g['points'] for g in recent)/minutes,
                        min(7, (date.fromisoformat(day)-date.fromisoformat(history[-1]['game_date'])).days-1),
                        sum(allowed)/len(allowed)]
            output.append(dict(game_id=row['game_id'], player_id=row['player_id'], date=day,
                actual=row['points'], baseline=baseline, features=features, sample_games=len(recent)))
        # Delayed updates keep all same-day outcomes out of the features.
        for row in player_days[day]:
            histories[(row['season'], row['player_id'])].append(row)
        for game in team_days[day]:
            defense[(game['season'], game['home_team'])].append(game['away_score'])
            defense[(game['season'], game['away_team'])].append(game['home_score'])
    return output


def metrics(rows, key):
    if not rows:
        raise ValueError('Evaluation split is empty')
    errors = [row[key]-row['actual'] for row in rows]
    return dict(appearances=len(rows), mae=sum(abs(e) for e in errors)/len(errors),
                rmse=math.sqrt(sum(e*e for e in errors)/len(errors)))


def fit(rows):
    x = np.array([row['features'] for row in rows])
    y = np.array([row['actual'] for row in rows])
    mean, scale = x.mean(axis=0), x.std(axis=0)
    scale[scale == 0] = 1
    design = np.column_stack([np.ones(len(x)), (x-mean)/scale])
    penalty = np.eye(design.shape[1])
    penalty[0, 0] = 0
    weights = np.linalg.solve(design.T @ design + penalty, design.T @ y)
    return mean, scale, weights


def main():
    with sqlite3.connect(DEFAULT_DB) as db:
        db.row_factory = sqlite3.Row
        players = [dict(row) for row in db.execute("SELECT * FROM player_games WHERE season='2025-26' ORDER BY game_date,game_id,player_id")]
        games = [dict(row) for row in db.execute("SELECT * FROM games WHERE season='2025-26' AND season_type='Regular Season' ORDER BY game_date,game_id")]
    rows = examples(players, games)
    train = [r for r in rows if r['date'] < TRAIN_END]
    if len(train) < 100:
        raise ValueError('Insufficient training history')
    mean, scale, weights = fit(train)
    for row in rows:
        row['challenger'] = max(0, float(np.r_[1, (np.array(row['features'])-mean)/scale] @ weights))
    development = [r for r in rows if TRAIN_END <= r['date'] < DEVELOPMENT_END]
    selected = 'challenger' if metrics(development,'challenger')['mae'] < metrics(development,'baseline')['mae'] else 'baseline'
    calibration = [r for r in rows if DEVELOPMENT_END <= r['date'] < CALIBRATION_END]
    residuals = sorted(abs(r[selected]-r['actual']) for r in calibration)
    if not residuals:
        raise ValueError('No calibration data')
    radius = residuals[min(len(residuals)-1, math.ceil((len(residuals)+1)*0.8)-1)]
    test = [r for r in rows if r['date'] >= CALIBRATION_END]
    covered = sum(max(0,r[selected]-radius) <= r['actual'] <= r[selected]+radius for r in test)
    report = dict(season='2025-26', features=FEATURES, minimum_prior_appearances=5,
        selected_model=selected, training_end_exclusive=TRAIN_END,
        development_end_exclusive=DEVELOPMENT_END, calibration_end_exclusive=CALIBRATION_END,
        train_appearances=len(train), calibration_appearances=len(calibration),
        development={key:metrics(development,key) for key in ['baseline','challenger']},
        test={key:metrics(test,key) for key in ['baseline','challenger']},
        interval=dict(target_coverage=0.8, radius=radius, test_coverage=covered/len(test)),
        coefficients=weights.tolist(), feature_means=mean.tolist(), feature_scales=scale.tolist(),
        source_sha256=hashlib.sha256(json.dumps([players,games],sort_keys=True).encode()).hexdigest(),
        limitations=['Conditional on actually appearing; does not predict availability.',
                     'Current corrected historical records, not archived pregame data.',
                     'Opponent input is team points allowed, not pace-adjusted defensive rating.',
                     'Interval calibrated across players; individual-player coverage is not guaranteed.',
                     'One season only. Test data must not be reused for further tuning.'])
    forecasts = {}
    for row in rows:
        # Baseline remains usable before the fixed challenger was trained/selected.
        model = selected if row['date'] >= DEVELOPMENT_END else 'baseline'
        prediction = row[model]
        forecasts[f"{row['game_id']}:{row['player_id']}"] = dict(points=prediction, baseline_points=row['baseline'],
            model=model, sample_games=row['sample_games'], inputs=dict(zip(FEATURES,row['features'])),
            range=[max(0,prediction-radius),prediction+radius] if row['date'] >= CALIBRATION_END else None)
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(dict(report=report,forecasts=forecasts),indent=2)+'\n')
    lines=['# Initial player-points evaluation','',
        'Training: before Jan 1, 2026. Model selection: Jan 1–15. Interval calibration: Jan 16–31. Test: Feb 1 through season end.',
        '', '| Model | Test appearances | Mean absolute error (points) | RMSE |', '|---|---:|---:|---:|']
    for key, result in report['test'].items():
        lines.append(f"| {key} | {result['appearances']} | {result['mae']:.3f} | {result['rmse']:.3f} |")
    lines += ['',f'Selected on development MAE: **{selected}**.',
              f'Nominal 80% pooled range: ±{radius:.2f} points; observed test coverage: {covered/len(test):.1%}.',
              '', 'Minimum five prior appearances. Baseline averages up to ten earlier games. Challenger is ridge regression (fixed penalty 1) using '+', '.join(FEATURES)+'.',
              '', '## Limitations',''] + ['- '+item for item in report['limitations']]
    (Path(__file__).parent/'PLAYER_POINTS_RESULTS.md').write_text('\n'.join(lines)+'\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
