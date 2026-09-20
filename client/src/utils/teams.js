const entries = {
  ATL: ['Atlanta', 'Hawks', '#c92b37'], BOS: ['Boston', 'Celtics', '#15803d'],
  BKN: ['Brooklyn', 'Nets', '#374151'], CHA: ['Charlotte', 'Hornets', '#087e8b'],
  CHI: ['Chicago', 'Bulls', '#c92b37'], CLE: ['Cleveland', 'Cavaliers', '#861b3b'],
  DAL: ['Dallas', 'Mavericks', '#1265b6'], DEN: ['Denver', 'Nuggets', '#a77b08'],
  DET: ['Detroit', 'Pistons', '#ce2638'], GSW: ['Golden State', 'Warriors', '#2463ce'],
  HOU: ['Houston', 'Rockets', '#cc263c'], IND: ['Indiana', 'Pacers', '#a57800'],
  LAC: ['LA', 'Clippers', '#245ba9'], LAL: ['Los Angeles', 'Lakers', '#753bbd'],
  MEM: ['Memphis', 'Grizzlies', '#526daa'], MIA: ['Miami', 'Heat', '#b82439'],
  MIL: ['Milwaukee', 'Bucks', '#23764f'], MIN: ['Minnesota', 'Timberwolves', '#236480'],
  NOP: ['New Orleans', 'Pelicans', '#967b45'], NYK: ['New York', 'Knicks', '#cf631e'],
  OKC: ['Oklahoma City', 'Thunder', '#147dc2'], ORL: ['Orlando', 'Magic', '#2676c5'],
  PHI: ['Philadelphia', '76ers', '#2365bb'], PHX: ['Phoenix', 'Suns', '#a34c1d'],
  POR: ['Portland', 'Trail Blazers', '#c62a37'], SAC: ['Sacramento', 'Kings', '#7543aa'],
  SAS: ['San Antonio', 'Spurs', '#4b5563'], TOR: ['Toronto', 'Raptors', '#cc293b'],
  UTA: ['Utah', 'Jazz', '#6243a4'], WAS: ['Washington', 'Wizards', '#b12c40'],
};

export function teamInfo(abbreviation) {
  const [city, name, color] = entries[abbreviation] || ['', abbreviation, '#475569'];
  return { city, name, color, fullName: `${city} ${name}`.trim() };
}
