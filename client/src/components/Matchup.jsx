import { useEffect, useState } from 'react';
import PlayerPhoto from './PlayerPhoto';
import { teamInfo } from '../utils/teams';
import { getData } from '../services/nbaApi';

const stats = [['points', 'Points'], ['rebounds', 'Rebounds'], ['assists', 'Assists'], ['minutes', 'Minutes']];
const number = (value) => value == null ? '—' : value.toFixed(1);

function GameLog({ games, label }) {
  if (!games.length) return <p className="table-note">No earlier appearances available for this selection.</p>;
  return <div className="table-scroll"><table><caption className="sr-only">{label}</caption><thead><tr><th>Date</th><th>Matchup</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead><tbody>{games.map((game) => <tr key={game.game_id}><th scope="row">{game.game_date}</th><td>{game.matchup}</td><td>{number(game.minutes)}</td><td>{game.points}</td><td>{game.rebounds}</td><td>{game.assists}</td></tr>)}</tbody></table></div>;
}

function Analysis({ gameId, playerId, window, showResults }) {
  const [state, setState] = useState({ loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getData(`matchups/${gameId}/players/${playerId}?window=${window}`, controller.signal)
      .then((data) => setState({ data }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ error: error.message }); });
    return () => controller.abort();
  }, [gameId, playerId, window, retry]);
  if (!state.data) return <div className="notice" role={state.error ? 'alert' : 'status'}>{state.error || 'Loading pregame history…'}{state.error && <button onClick={() => { setState({ loading: true }); setRetry((n) => n + 1); }}>Try again</button>}</div>;
  const data = state.data;
  const actual = data.actual_points;
  const difference = data.projection && actual != null ? actual - data.projection.points : null;
  const insideRange = data.projection?.range && actual != null ? actual >= data.projection.range[0] && actual <= data.projection.range[1] : null;
  return <>
    <div className="page-heading player-heading"><PlayerPhoto id={data.player_id} name={data.name} large /><div><h2>{data.name}</h2><p>{teamInfo(data.team).fullName} vs. {teamInfo(data.opponent).fullName}</p><p className="table-note">History strictly before {data.game.date} · {data.game.season} regular season</p></div></div>
    <section className="points-projection table-panel"><span className="eyebrow">PLAYER POINTS / HISTORICAL FORECAST</span>
      <div className="projection-comparison" aria-live="polite">
        <div><span>PROJECTED POINTS</span><strong>{number(data.projection?.points)}</strong></div>
        <div><span>ACTUAL POINTS</span><strong>{showResults ? (actual ?? 'Awaiting result') : 'Hidden'}</strong></div>
        <div><span>ACTUAL − PROJECTED</span><strong>{showResults && difference != null ? `${difference > 0 ? '+' : ''}${number(difference)}` : '—'}</strong></div>
      </div>
      {showResults && difference != null && <p>{Math.abs(difference).toFixed(1)} points {difference > 0 ? 'above' : difference < 0 ? 'below' : 'from'} the projection.{insideRange != null && <> Actual score was <b>{insideRange ? 'inside' : 'outside'}</b> the estimated range.</>}</p>}
      {!showResults && <p>Replay mode: actual points and the comparison are hidden.</p>}
      {data.projection ? <><p>Average of {data.projection.sample_games} prior appearances. This baseline stays fixed when you change the history window.</p>
        <p>{data.projection.range ? <>Approximate 80% range: <b>{number(data.projection.range[0])}–{number(data.projection.range[1])} points</b>. Calibrated across players using earlier January games.</> : 'No calibrated range available for this date. Ranges begin February 1, 2026.'}</p>
        <details><summary>How accurate was this baseline?</summary><p>Across {data.projection.evaluation.appearances.toLocaleString()} eligible appearances from {data.projection.evaluation_period}, average absolute error was {number(data.projection.evaluation.mae)} points. This is retrospective evaluation, not information available at the selected game.</p><p>The nominal 80% range covered {(data.projection.interval_coverage * 100).toFixed(1)}% of held-out outcomes. Individual-player coverage can differ. No injury or availability prediction is included.</p></details></> : <p>No projection available. At least five prior appearances and a generated player-points backtest are required.</p>}
    </section>
    <div className="metric-grid">{stats.map(([key, label]) => <div className="metric" key={key}><span>{label.toUpperCase()}</span><strong>{number(data.averages[key])}</strong><small>{data.sample_games} prior appearances</small></div>)}</div>
    {!data.sample_games && <div className="evaluation-note">No earlier appearances in this season. Missing history is not treated as a zero-point performance.</div>}
    <section className="table-panel"><h3>Against {teamInfo(data.opponent).fullName}</h3><p className="table-note">{data.opponent_sample_games} earlier meetings in this season, independent of the recent-game window. Small samples can be misleading.</p><div className="opponent-averages">{stats.map(([key, label]) => <div key={key}><strong>{number(data.opponent_averages[key])}</strong><span>{label}</span></div>)}</div><GameLog games={data.opponent_games} label="Earlier games against this opponent" /></section>
    <section className="table-panel player-log"><h3>{window === 'season' ? 'Season to date' : `Last ${window} appearances`} · {data.sample_games} available</h3><GameLog games={data.games} label="Pregame appearance history" /></section>
    <p className="table-note">The points forecast is a baseline, not a guarantee; other statistics are descriptive. This view uses corrected game logs and current headshots. The participant list was determined after the game; it does not establish who was expected to play beforehand.</p>
  </>;
}

export default function Matchup({ game, onBack, showResults, onShowResults }) {
  const [state, setState] = useState({ loading: true });
  const [selected, setSelected] = useState(null);
  const [window, setWindow] = useState('10');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getData(`matchups/${game.game_id}`, controller.signal)
      .then((data) => setState({ data }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ error: error.message }); });
    return () => controller.abort();
  }, [game.game_id, retry]);
  return <section className="matchup-view"><button onClick={selected ? () => setSelected(null) : onBack}>← {selected ? 'Game participants' : 'Game slate'}</button><label className="results-toggle matchup-results-toggle"><input type="checkbox" checked={showResults} onChange={(event) => onShowResults(event.target.checked)} /><span className="switch" />Show results</label><div className="section-intro"><span className="eyebrow">{game.date} / HISTORICAL MATCHUP</span><h2>{teamInfo(game.away_team).fullName} vs. {teamInfo(game.home_team).fullName}</h2><p>Actual game participants · not an archived pregame roster</p></div>
    {selected ? <><div className="filter-tabs matchup-windows" aria-label="Pregame statistics window">{[['5', 'Last 5'], ['10', 'Last 10'], ['season', 'Season to date']].map(([value, label]) => <button key={value} aria-pressed={window === value} className={window === value ? 'selected' : ''} onClick={() => setWindow(value)}>{label}</button>)}</div><Analysis key={`${selected}-${window}`} gameId={game.game_id} playerId={selected} window={window} showResults={showResults} /></> : !state.data ? <div className="notice" role={state.error ? 'alert' : 'status'}>{state.error || 'Loading participants…'}{state.error && <button onClick={() => { setState({ loading: true }); setRetry((n) => n + 1); }}>Try again</button>}</div> : !state.data.players.length ? <div className="notice">No player logs are available for this game yet. Player data currently covers the imported 2025–26 season.</div> : <div className="matchup-teams">{[game.away_team, game.home_team].map((team) => <section key={team}><h3>{teamInfo(team).fullName}</h3><div className="participant-list">{state.data.players.filter((player) => player.team === team).map((player) => <button key={player.player_id} onClick={() => setSelected(player.player_id)}><PlayerPhoto id={player.player_id} name={player.name} /><span><strong>{player.name}</strong><small>View pregame history →</small></span></button>)}</div></section>)}</div>}
  </section>;
}
