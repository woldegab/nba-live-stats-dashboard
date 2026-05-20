import teamLogos from "../utils/teamLogos";

function GameCard({
  homeTeam,
  visitorTeam,
  homeScore,
  visitorScore,
}) {
  return (
    <div className="rounded-xl bg-slate-900 p-6 border border-slate-800 hover:border-blue-500 transition">

      <div className="flex items-center justify-between mb-4">

        <div className="flex items-center gap-4">

          <img
            src={teamLogos[homeTeam.abbreviation]}
            alt={homeTeam.full_name}
            className="w-14 h-14"
          />

          <div>
            <h3 className="text-lg font-bold">
              {homeTeam.full_name}
            </h3>

            <p className="text-slate-400">
              {homeTeam.abbreviation}
            </p>
          </div>

        </div>

        <p className="text-3xl font-bold">
          {homeScore}
        </p>

      </div>

      <div className="border-t border-slate-800 my-4"></div>

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-4">

          <img
            src={teamLogos[visitorTeam.abbreviation]}
            alt={visitorTeam.full_name}
            className="w-14 h-14"
          />

          <div>
            <h3 className="text-lg font-bold">
              {visitorTeam.full_name}
            </h3>

            <p className="text-slate-400">
              {visitorTeam.abbreviation}
            </p>
          </div>

        </div>

        <p className="text-3xl font-bold">
          {visitorScore}
        </p>

      </div>

    </div>
  );
}

export default GameCard;