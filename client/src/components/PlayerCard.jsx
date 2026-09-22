import PlayerPhoto from './PlayerPhoto';
import { teamInfo } from '../utils/teams';

export default function PlayerCard({ player, onSelect, window = '10' }) {
  return <button className="player-card" onClick={() => onSelect(player.player_id)}>
    <div className="player-identity"><PlayerPhoto id={player.player_id} name={player.name} /><div><h3>{player.name}</h3><p>{teamInfo(player.team).fullName}</p></div></div>
    <div className="player-stats">{[['points', 'PTS'], ['rebounds', 'REB'], ['assists', 'AST']].map(([key, label]) => <div key={key}><strong>{player[key].toFixed(1)}</strong><span>{label}</span></div>)}</div>
    <div className="player-card-footer"><span>{window === 'season' ? 'Full season' : 'Recent'} · {player.sample_games} appearances</span><span>View games →</span></div>
  </button>;
}
