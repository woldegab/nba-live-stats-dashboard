import teamLogos from "../utils/teamLogos";

function GameCard({
  homeTeam,
  visitorTeam,
  homeScore,
  visitorScore,
  status,
}) {
  const isLive = status?.toLowerCase().includes("q") || status?.toLowerCase().includes("live");
  const isFinal = status?.toLowerCase().includes("final");

  return (
    <div className="rounded-xl bg-slate-900 p-6 border border-slate-800 hover:border-blue-500 transition">
      <div className="flex justify-between items-center mb-4">
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            isLive
              ? "bg-red-600 text-white"
              : isFinal
              ? "bg-slate-700 text-slate-200"
              : "bg-blue-600 text-white"
          }`}
        >
          {isLive ? "LIVE" : isFinal ? "FINAL" : "SCHEDULED"}
        </span>

        <span className="text-sm text-slate-400">
          {status || "Status unavailable"}
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <img
            src={teamLogos[homeTeam.abbreviation]}
            alt={homeTeam.full_name}
            className="w-14 h-14"
          />

          <div>
            <h3 className="text-lg font-bold">{homeTeam.full_name}</h3>
            <p className="text-slate-400">{homeTeam.abbreviation}</p>
          </div>
        </div>

        <p className="text-3xl font-bold">{homeScore}</p>
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
            <h3 className="text-lg font-bold">{visitorTeam.full_name}</h3>
            <p className="text-slate-400">{visitorTeam.abbreviation}</p>
          </div>
        </div>

        <p className="text-3xl font-bold">{visitorScore}</p>
      </div>
    </div>
  );
}

export default GameCard;