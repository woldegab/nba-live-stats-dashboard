import { useEffect, useState } from 'react';
import GameCard from './components/GameCard';
import Players from './components/Players';
import Matchup from './components/Matchup';
import Icon from './components/Icon';
import { getData } from './services/nbaApi';
import { teamInfo } from './utils/teams';
import './App.css';

const pct = (value) => `${(value * 100).toFixed(1)}%`;
const dateLabel = (date, options = { month: 'long', day: 'numeric', year: 'numeric' }) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', options);
const views = [{ id: 'players', label: 'Players', icon: 'target' }, { id: 'games', label: 'Game predictions', icon: 'grid' }, { id: 'analytics', label: 'Model analytics', icon: 'chart' }, { id: 'method', label: 'How it works', icon: 'layers' }];

function ErrorNotice({ message, retry }) {
  return <div className="notice error" role="alert"><Icon name="info" /><strong>Unable to load the archive</strong><p>{message}</p><button className="primary-button" onClick={retry}>Try again</button></div>;
}

function Comparison({ result }) {
  return <div className="comparison-chart" role="img" aria-label={`Elo accuracy ${pct(result.elo.accuracy)}, home-team baseline ${pct(result.always_pick_designated_home_accuracy)}`}>
    <div className="chart-row"><div><span>Elo model</span><b>{pct(result.elo.accuracy)}</b></div><div className="chart-track"><span style={{ width: pct(result.elo.accuracy) }} /></div></div>
    <div className="chart-row baseline"><div><span>Home-team baseline</span><b>{pct(result.always_pick_designated_home_accuracy)}</b></div><div className="chart-track"><span style={{ width: pct(result.always_pick_designated_home_accuracy) }} /></div></div>
    <div className="chart-axis"><span>0%</span><span>50%</span><span>100%</span></div>
  </div>;
}

function SeasonSummary({ selected, result, onAnalytics }) {
  const difference = result ? (result.elo.accuracy - result.always_pick_designated_home_accuracy) * 100 : null;
  return <aside className="insight-column">
    <section className="season-panel"><div className="panel-heading"><Icon name="chart" /><h2>Season snapshot</h2></div><p className="subtle">{selected.season} · {selected.phase}</p>
      {result ? <><div className="accuracy-number">{pct(result.elo.accuracy)}<span>WINNER ACCURACY</span></div><Comparison result={result} /><div className="comparison-note"><b>{difference >= 0 ? '+' : ''}{difference.toFixed(1)} pp</b><span>versus always picking the home team</span></div></> : <div className="warmup-note"><Icon name="layers" /><h3>Learning team strength</h3><p>This season initializes the ratings. Evaluation starts the following season.</p></div>}
      <button className="text-button" onClick={onAnalytics}>Explore model analytics <Icon name="arrow" /></button>
    </section>
    <section className="explainer-panel"><span className="mini-label">READING THE FORECAST</span><h3>A probability,<br />not a promise.</h3><p>A 70% forecast still leaves a 30% chance for the other team. Every pick here is a historical reconstruction.</p><div><Icon name="info" /><span>Based on prior results and venue. No injury or lineup information.</span></div></section>
  </aside>;
}

function Games({ date, retry }) {
  const [matchup, setMatchup] = useState(null);
  const [state, setState] = useState({ loading: true });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [showResults, setShowResults] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    getData(`games?date=${encodeURIComponent(date)}`, controller.signal)
      .then((data) => setState({ games: data.games }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ error: error.message }); });
    return () => controller.abort();
  }, [date]);
  if (matchup) return <Matchup key={matchup.game_id} game={matchup} showResults={showResults} onShowResults={(value) => { setShowResults(value); setFilter('all'); }} onBack={() => setMatchup(null)} />;
  if (state.loading) return <div className="notice" role="status">Loading game predictions…</div>;
  if (state.error) return <ErrorNotice message={state.error} retry={retry} />;
  const games = state.games;
  const search = query.trim().toLowerCase();
  const visible = games.filter((game) => {
    const teamMatch = [game.home_team, game.away_team, teamInfo(game.home_team).fullName, teamInfo(game.away_team).fullName].some((team) => team.toLowerCase().includes(search));
    return teamMatch && (filter === 'all' || (filter === 'correct' ? game.correct : !game.correct));
  });
  const correct = games.filter((game) => game.correct).length;
  return <>
    <div className="slate-heading"><div><h2>Game slate <span>{games.length}</span></h2><p>{dateLabel(date)}{showResults && games.length > 0 ? ` · ${correct} of ${games.length} picks correct` : ''}</p></div><label className="results-toggle"><input type="checkbox" checked={showResults} onChange={(event) => { setShowResults(event.target.checked); setFilter('all'); }} /><span className="switch" />Show results</label></div>
    <div className="slate-tools"><div className="filter-tabs" aria-label="Filter game results">{[['all', 'All games'], ['correct', 'Correct'], ['missed', 'Missed']].map(([id, label]) => <button key={id} disabled={!showResults && id !== 'all'} aria-pressed={filter === id} className={filter === id ? 'selected' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div><label className="search-field"><Icon name="search" /><input aria-label="Search teams" placeholder="Search teams…" value={query} onChange={(event) => setQuery(event.target.value)} type="search" /></label></div>
    {!games.length ? <div className="notice"><Icon name="calendar" /><h3>No games on this date</h3><p>Choose another date or use the arrows to find the next game day.</p></div> : !visible.length ? <div className="notice"><h3>No matching games</h3><p>Try another team or reset your filters.</p><button onClick={() => { setQuery(''); setFilter('all'); }}>Reset filters</button></div> : <><p className="sr-only" role="status">Showing {visible.length} games</p><div className="game-grid">{visible.map((game) => <GameCard key={game.game_id} game={game} showResults={showResults} onExplore={() => setMatchup(game)} />)}</div></>}
  </>;
}

function Analytics({ report }) {
  return <section className="analytics-view"><div className="section-intro"><h2>Measured against a simple benchmark.</h2><p>Same games, same seasons. Compare winner accuracy and the quality of our probabilities.</p></div>
    <div className="analytics-charts">{Object.entries(report.results).map(([season, result]) => <article className="analytics-panel" key={season}><div className="panel-heading"><h3>{season}</h3><span className="phase-badge">{season === report.test_season ? 'Initial test' : 'Development'}</span></div><div className="analytic-lead"><strong>{pct(result.elo.accuracy)}</strong><span>correct winner picks<br />across {result.games.toLocaleString()} games</span></div><Comparison result={result} /></article>)}</div>
    <section className="table-panel"><div className="panel-heading"><h3>The full scorecard</h3><span className="subtle">Lower Brier and log loss are better</span></div><div className="table-scroll"><table><caption className="sr-only">Historical Elo model performance and baselines</caption><thead><tr><th>Season</th><th>Elo accuracy</th><th>Home-pick accuracy</th><th>Elo Brier</th><th>Baseline Brier</th><th>Elo log loss</th></tr></thead><tbody>{Object.entries(report.results).map(([year, result]) => <tr key={year}><th scope="row">{year}</th><td className="highlight">{pct(result.elo.accuracy)}</td><td>{pct(result.always_pick_designated_home_accuracy)}</td><td>{result.elo.brier.toFixed(4)}</td><td>{result.home_rate_baseline.brier.toFixed(4)}</td><td>{result.elo.log_loss.toFixed(4)}</td></tr>)}</tbody></table></div><p className="table-note">The probability baseline uses the {report.warmup_season} home-win rate and 50/50 at neutral venues. A constant 50/50 forecast has a Brier score of 0.25.</p></section>
    <div className="evaluation-note"><Icon name="info" /><p>These results describe historical backtests, not future performance. The test season has now been inspected; further tuning should use development data.</p></div>
  </section>;
}

function Method({ report }) {
  const steps = [['01', 'Build team ratings', `Every team starts at ${report.parameters.initial_rating.toLocaleString()}. The ${report.warmup_season} season establishes the initial ratings.`], ['02', 'Forecast before the game', `Compare both ratings and add ${report.parameters.home_advantage} Elo points for home court. Neutral venues receive no bonus.`], ['03', 'Learn from the result', 'After each date, winners gain points and losers lose them. An unexpected win creates a larger adjustment. No same-day result affects another forecast.'], ['04', 'Evaluate what happened', 'Compare saved forecasts with results. Track both winner accuracy and probability error against a simple baseline.']];
  return <section className="method-view"><div className="section-intro"><h2>Understand every prediction.</h2><p>A transparent Elo baseline, evaluated one game day at a time.</p></div><div className="method-steps">{steps.map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div><div className="table-panel limits"><h3>What this version includes</h3><p>Team results, venue, and offseason rating regression. Ratings retain {report.parameters.retention * 100}% of their distance from 1,500 between seasons. The update factor is K = {report.parameters.k}.</p><h3>Where it is limited</h3><p>No injuries, lineups, player stats, rest days, or playoff updates. Forecasts are reconstructed using corrected historical records, rather than snapshots saved before the actual games. A 50/50 forecast uses the designated home team as the tie-breaker.</p></div></section>;
}

function Dashboard({ view, onView }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [season, setSeason] = useState('');
  const [date, setDate] = useState('');
  const [gamesAttempt, setGamesAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getData('seasons', controller.signal), getData('model-performance', controller.signal)])
      .then(([available, report]) => {
        if (!available.seasons.length) throw new Error('No seasons are available yet.');
        const initial = available.seasons.find((item) => item.season === report.test_season) || available.seasons[0];
        setData({ ...available, report }); setSeason(initial.season); setDate(initial.first_date);
      }).catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message); });
    return () => controller.abort();
  }, [attempt]);
  if (error) return <ErrorNotice message={error} retry={() => { setError(''); setAttempt((n) => n + 1); }} />;
  if (!data) return <div className="notice" role="status">Loading the model archive…</div>;
  const selected = data.seasons.find((item) => item.season === season);
  const result = data.report.results[season];
  const previous = selected.dates.filter((day) => day < date).at(-1);
  const next = selected.dates.find((day) => day > date);
  const index = selected.dates.findIndex((day) => day >= date);
  const start = Math.max(0, Math.min((index < 0 ? selected.dates.length - 1 : index) - 3, selected.dates.length - 7));
  const days = selected.dates.slice(start, start + 7);
  return <>
    <div className="page-heading"><div><span className="eyebrow">NBA / {view === 'games' ? 'PREDICTION ARCHIVE' : view === 'analytics' ? 'MODEL EVALUATION' : 'METHODOLOGY'}</span><h1>{view === 'games' ? 'The game. The numbers.' : view === 'analytics' ? 'Performance, in perspective.' : 'Inside the model.'}</h1><p>{view === 'games' ? 'Explore the forecast. See how the game played out.' : view === 'analytics' ? 'A closer look at what our first model gets right.' : 'Simple inputs. Explainable predictions.'}</p></div>{view === 'games' && <label className="season-select"><span>Season</span><select value={season} onChange={(event) => { const item = data.seasons.find((s) => s.season === event.target.value); setSeason(item.season); setDate(item.first_date); }}>{data.seasons.map((item) => <option key={item.season} value={item.season}>{item.season} · {item.phase}</option>)}</select></label>}</div>
    {view === 'games' ? <>
      <section className="metric-grid" aria-label="Selected season metrics">
        <div className="metric"><span><Icon name="target" /> MODEL ACCURACY</span><strong>{result ? pct(result.elo.accuracy) : 'Warm-up'}</strong><small>{selected.phase} · {season}</small></div>
        <div className="metric"><span><Icon name="chart" /> ABOVE BASELINE</span><strong>{result ? `${result.elo.accuracy >= result.always_pick_designated_home_accuracy ? '+' : ''}${((result.elo.accuracy - result.always_pick_designated_home_accuracy) * 100).toFixed(1)}` : '—'}{result && <em>pp</em>}</strong><small>Versus home-team picks</small></div>
        <div className="metric"><span><Icon name="grid" /> GAMES ANALYZED</span><strong>{selected.games.toLocaleString()}</strong><small>30 teams · regular season</small></div>
        <div className="metric"><span><Icon name="layers" /> BRIER SCORE</span><strong>{result ? result.elo.brier.toFixed(3) : '—'}</strong><small>Probability error · lower is better</small></div>
      </section>
      <div className="date-toolbar"><button className="date-arrow" aria-label="Previous game day" disabled={!previous} onClick={() => setDate(previous)}><Icon name="arrow" className="flip" /></button><div className="date-strip" aria-label="Game dates">{days.map((day) => <button className={date === day ? 'active' : ''} aria-pressed={date === day} key={day} onClick={() => setDate(day)}><span>{dateLabel(day, { weekday: 'short' })}</span><strong>{dateLabel(day, { month: 'short', day: 'numeric' })}</strong></button>)}</div><button className="date-arrow" aria-label="Next game day" disabled={!next} onClick={() => setDate(next)}><Icon name="arrow" /></button><label className="date-picker"><Icon name="calendar" /><input type="date" aria-label="Choose game date" value={date} min={selected.first_date} max={selected.last_date} onChange={(event) => { const day = event.target.value; if (day && day >= selected.first_date && day <= selected.last_date) setDate(day); }} /></label></div>
      <div className="dashboard-columns"><section className="slate"><Games key={`${date}-${gamesAttempt}`} date={date} retry={() => setGamesAttempt((n) => n + 1)} /></section><SeasonSummary selected={selected} result={result} onAnalytics={() => onView('analytics')} /></div>
    </> : view === 'analytics' ? <Analytics report={data.report} /> : <Method report={data.report} />}
    <footer><span>NBA Forecast Lab <span className="footer-divider">/</span> Historical backtests</span><span>Data snapshot: {new Date(data.generated_at).toLocaleDateString('en-US')}</span></footer>
  </>;
}

export default function App() {
  const [view, setView] = useState('players');
  return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a><aside className="sidebar"><a href="#main" className="brand" onClick={() => setView('games')}><span className="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" /><path d="M4 16h24M16 4v24M7 7c12 3 12 15 18 18M25 7C13 10 13 22 7 25" /></svg></span><span>FORECAST<span className="brand-secondary">LAB <i>NBA</i></span></span></a><span className="sidebar-label">WORKSPACE</span><nav aria-label="Main navigation">{views.map((item) => <button key={item.id} aria-current={view === item.id ? 'page' : undefined} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><Icon name={item.icon} />{item.label}{view === item.id && <span className="nav-dot" />}</button>)}</nav><div className="sidebar-bottom"><span className="model-version"><i /> ELO MODEL / V1</span><p>Every prediction.<br />Open to evaluation.</p><div className="sidebar-foot">Independent NBA analytics</div></div></aside><div className="workspace"><header className="topbar"><div><span>Workspace</span><Icon name="arrow" /><strong>{views.find((item) => item.id === view).label}</strong></div><span className="archive-tag"><span /> Historical backtest</span></header><main id="main">{view === 'players' ? <Players /> : <Dashboard view={view} onView={setView} />}</main></div></div>;
}
