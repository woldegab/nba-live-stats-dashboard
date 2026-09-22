"""Read saved, date-safe point projections without exposing target outcomes."""
from functools import lru_cache
import json
from pathlib import Path

ARTIFACT = Path(__file__).parent / 'data' / 'player_points.json'


@lru_cache(maxsize=2)
def load(path, modified):
    return json.loads(Path(path).read_text())


def projection(game_id, player_id):
    try:
        data = load(str(ARTIFACT), ARTIFACT.stat().st_mtime_ns)
    except (OSError, ValueError):
        return None
    forecast = data['forecasts'].get(f'{game_id}:{player_id}')
    if forecast is None:
        return None
    return {**forecast, 'evaluation': data['report']['test'][forecast['model']],
            'interval_coverage': data['report']['interval']['test_coverage'],
            'evaluation_period': '2026-02-01 through the end of the 2025–26 regular season'}
