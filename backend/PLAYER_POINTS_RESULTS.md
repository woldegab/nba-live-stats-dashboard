# Initial player-points evaluation

Training: before Jan 1, 2026. Model selection: Jan 1–15. Interval calibration: Jan 16–31. Test: Feb 1 through season end.

| Model | Test appearances | Mean absolute error (points) | RMSE |
|---|---:|---:|---:|
| baseline | 10468 | 4.769 | 6.260 |
| challenger | 10468 | 4.722 | 6.174 |

Selected on development MAE: **baseline**.
Nominal 80% pooled range: ±7.10 points; observed test coverage: 77.8%.

Minimum five prior appearances. Baseline averages up to ten earlier games. Challenger is ridge regression (fixed penalty 1) using points_last10, minutes_last5, points_per_minute_last10, rest_days_capped7, opponent_points_allowed_last10.

## Limitations

- Conditional on actually appearing; does not predict availability.
- Current corrected historical records, not archived pregame data.
- Opponent input is team points allowed, not pace-adjusted defensive rating.
- Interval calibrated across players; individual-player coverage is not guaranteed.
- One season only. Test data must not be reused for further tuning.
