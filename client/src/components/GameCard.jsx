import { useState } from 'react';
import teamLogos from '../utils/teamLogos';
import { teamInfo } from '../utils/teams';
import Icon from './Icon';

const pct = (value) => `${(value * 100).toFixed(1)}%`;

function TeamRow({ abbreviation, score, home, winner, showResults }) {
  const team = teamInfo(abbreviation);
  const [failed, setFailed] = useState(false);
  return <div className={`team-row ${showResults && winner ? 'winning-team' : ''}`}>
    <div className="team-logo" style={{ '--team-color': team.color }}>
      {!failed && teamLogos[abbreviation]
        ? <img src={teamLogos[abbreviation]} alt="" loading="lazy" onError={() => setFailed(true)} />
        : <span>{abbreviation}</span>}
    </div>
    <div className="team-name"><span>{team.city} <small>{home ? 'HOME' : 'AWAY'}</small></span><strong>{team.name}</strong></div>
    <strong className="team-score">{showResults ? score : '—'}{showResults && winner && <span className="winner-marker" aria-label="Winner">◂</span>}</strong>
  </div>;
}

export default function GameCard({ game, showResults = true, onExplore }) {
  const even = game.home_win_probability === 0.5;
  const favorite = teamInfo(game.predicted_winner);
  const away = teamInfo(game.away_team);
  const home = teamInfo(game.home_team);
  return <article className="game-card" aria-label={`${away.fullName} at ${home.fullName}`}>
    <div className="card-top"><span className="game-status"><i />{showResults ? 'FINAL' : 'RESULT HIDDEN'}{game.neutral_site && <span> · NEUTRAL SITE</span>}</span>
      {showResults && <span className={`result ${game.correct ? 'correct' : 'miss'}`}>{game.correct ? <Icon name="check" /> : <span>×</span>}{game.correct ? 'Correct pick' : 'Missed pick'}</span>}
    </div>
    <div className="teams">
      <TeamRow abbreviation={game.away_team} score={game.away_score} winner={game.actual_winner === game.away_team} showResults={showResults} />
      <TeamRow abbreviation={game.home_team} score={game.home_score} home winner={game.actual_winner === game.home_team} showResults={showResults} />
    </div>
    <div className="forecast-block">
      <div className="forecast-label"><span>WIN PROBABILITY</span><span>Elo forecast</span></div>
      <div className="prob-label"><span>{game.away_team} <b>{pct(game.away_win_probability)}</b></span><span><b>{pct(game.home_win_probability)}</b> {game.home_team}</span></div>
      <div className="prob-bar" role="img" aria-label={`${away.fullName} ${pct(game.away_win_probability)}, ${home.fullName} ${pct(game.home_win_probability)}`} style={{ background: home.color }}><div style={{ width: pct(game.away_win_probability), background: away.color }} /></div>
      <div className="model-pick"><Icon name="target" /><span>{even ? 'Even forecast' : 'Model favors'} <strong>{even ? '50 / 50' : favorite.fullName}</strong></span></div>
    </div>
    {onExplore && <button className="explore-players" onClick={onExplore}>Explore player matchups <Icon name="arrow" /></button>}
    <details><summary>Prediction breakdown <Icon name="arrow" /></summary><div className="breakdown"><div><span>{game.away_team} pregame Elo</span><b>{game.away_rating.toFixed(0)}</b></div><div><span>{game.home_team} pregame Elo</span><b>{game.home_rating.toFixed(0)}</b></div><p>{game.neutral_site ? 'Home and away are designations only. No home-court bonus at this neutral venue.' : 'The home team receives a 65-point Elo bonus.'} Only results from earlier dates affect these ratings.{even && ' The designated home team breaks a 50/50 tie for evaluation.'}</p></div></details>
  </article>;
}
