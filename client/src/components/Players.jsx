import { useEffect, useState } from 'react';
import PlayerCard from './PlayerCard';
import PlayerPhoto from './PlayerPhoto';
import { getData } from '../services/nbaApi';
import { teamInfo } from '../utils/teams';

function PlayerDetail({ id, season, window, onWindow, onBack }) {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getData(`players/${id}?season=${encodeURIComponent(season)}&window=${window}`, controller.signal)
      .then((data) => setState({ data }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ error: error.message }); });
    return () => controller.abort();
  }, [id, season, window, attempt]);
  if (!state.data) return <div className="notice"><button onClick={onBack}>← All players</button><p role={state.error ? 'alert' : 'status'}>{state.error || 'Loading player games…'}</p>{state.error && <button onClick={() => { setState({ loading: true }); setAttempt((n) => n + 1); }}>Try again</button>}</div>;
  const player = state.data;
  const chronological = [...player.games].reverse();
  const maximum = Math.max(...chronological.map((game) => game.points), 1);
  return <section>
    <button onClick={onBack}>← All players</button>
    <div className="page-heading player-heading"><PlayerPhoto id={player.player_id} name={player.name} large /><div><span className="eyebrow">{season} / PLAYER GAME LOG</span><h1>{player.name}</h1><p>{teamInfo(player.team).fullName} at latest appearance · {window === 'season' ? 'Full season' : `Last ${window}`} · {player.sample_games} recorded games</p></div></div>
    <WindowControls value={window} onChange={onWindow} />
    <div className="metric-grid">{[['points', 'POINTS'], ['rebounds', 'REBOUNDS'], ['assists', 'ASSISTS'], ['minutes', 'MINUTES']].map(([key, label]) => <div className="metric" key={key}><span>{label}</span><strong>{player.averages[key].toFixed(1)}</strong><small>Average over {player.sample_games} appearances</small></div>)}</div>
    <section className="table-panel"><h2>{window === 'season' ? 'Season scoring' : 'Recent scoring'}</h2><p className="subtle">Oldest to newest · actual points, not projections</p><div className="player-chart" aria-label="Points in recent games">{chronological.map((game) => <div key={game.game_id} className="player-chart-column"><strong>{game.points}</strong><div className="player-chart-track"><span style={{ height: `${game.points / maximum * 100}%` }} /></div><small>{game.game_date.slice(5)}</small></div>)}</div></section>
    <section className="table-panel player-log"><h2>{player.sample_games} appearances</h2><div className="table-scroll"><table><caption className="sr-only">Recent appearances, newest first</caption><thead><tr><th>Date</th><th>Matchup</th><th>Result</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead><tbody>{player.games.map((game) => <tr key={game.game_id}><th scope="row">{game.game_date}</th><td>{game.matchup}</td><td>{game.result}</td><td>{game.minutes.toFixed(1)}</td><td>{game.points}</td><td>{game.rebounds}</td><td>{game.assists}</td></tr>)}</tbody></table></div></section>
    <p className="table-note">Regular-season appearances only. Games not played are not counted as zero. Team labels reflect the historical record and may differ from a player’s current team. Photos use the NBA’s latest available headshots, so uniforms may differ from this season’s team.</p>
  </section>;
}

function WindowControls({ value, onChange }) {
  return <div className="filter-tabs player-windows" aria-label="Player statistics window">{[['5','Last 5'],['10','Last 10'],['season','Full season']].map(([key,label]) => <button key={key} className={value === key ? 'selected' : ''} aria-pressed={value === key} onClick={() => onChange(key)}>{label}</button>)}</div>;
}

export default function Players() {
  const [window, setWindow] = useState('10');
  const [state, setState] = useState({ loading: true });
  const [season, setSeason] = useState('');
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('all');
  const [selected, setSelected] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getData(`players?window=${window}${season ? `&season=${encodeURIComponent(season)}` : ''}`, controller.signal)
      .then((data) => setState({ data }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ error: error.message }); });
    return () => controller.abort();
  }, [season, window, attempt]);
  if (!state.data) return <div className="notice"><p role={state.error ? 'alert' : 'status'}>{state.error || 'Loading players…'}</p>{state.error && <button onClick={() => { setState({ loading: true }); setAttempt((n) => n + 1); }}>Try again</button>}</div>;
  const data = state.data;
  if (selected) return <PlayerDetail key={`${selected}-${data.season}-${window}`} id={selected} season={data.season} window={window} onWindow={setWindow} onBack={() => setSelected(null)} />;
  const teams = [...new Set(data.players.map((player) => player.team))].sort();
  const visible = data.players.filter((player) => player.name.toLowerCase().includes(query.trim().toLowerCase()) && (team === 'all' || player.team === team));
  return <section><div className="page-heading"><div><span className="eyebrow">NBA / PLAYER EXPLORER</span><h1>Start with the player.</h1><p>Recent performances, real game logs, and the numbers behind them.</p></div><label className="season-select">Season<select value={data.season} onChange={(event) => { setState({ loading: true }); setTeam('all'); setSeason(event.target.value); }}>{data.seasons.map((value) => <option key={value}>{value}</option>)}</select></label></div>
    <WindowControls value={window} onChange={(value) => { if (value !== window) { setState({ loading: true }); setWindow(value); } }} />
    <div className="player-filters"><label>Player name<input type="search" placeholder="Search LeBron, Curry, Jokić…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label>Team at latest appearance<select value={team} onChange={(event) => setTeam(event.target.value)}><option value="all">All teams</option>{teams.map((value) => <option key={value} value={value}>{teamInfo(value).fullName}</option>)}</select></label></div>
    <p className="table-note">{data.season} regular season · {window === 'season' ? 'Full-season averages.' : `Averages use up to ${window} recent recorded appearances.`} Historical statistics, not predictions.</p>
    <p className="subtle" role="status">{visible.length} players</p>
    {visible.length ? <div className="player-grid">{visible.map((player) => <PlayerCard key={player.player_id} player={player} window={window} onSelect={setSelected} />)}</div> : <div className="notice">No players match these filters. <button onClick={() => { setQuery(''); setTeam('all'); }}>Clear filters</button></div>}
  </section>;
}
