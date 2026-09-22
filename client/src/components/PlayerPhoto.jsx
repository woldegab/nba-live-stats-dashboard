import { useState } from 'react';

export default function PlayerPhoto({ id, name, large = false }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`;
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('');

  return <span className={`player-photo${large ? ' player-photo-large' : ''}`}>
    <span className="photo-initials" aria-hidden="true">{initials}</span>
    {id && failedSource !== source && <img
      src={source}
      alt={`${name} headshot`}
      loading={large ? 'eager' : 'lazy'}
      decoding="async"
      width="260"
      height="190"
      onError={() => setFailedSource(source)}
    />}
  </span>;
}
