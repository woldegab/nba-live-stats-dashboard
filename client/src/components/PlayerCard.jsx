import { Link } from "react-router-dom";

function PlayerCard({ player }) {
  return (
    <Link to={`/player/${player.id}`}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition cursor-pointer">
        <h3 className="text-2xl font-bold mb-4">
          {player.first_name} {player.last_name}
        </h3>

        <p className="text-slate-400">
          Team: {player.team.full_name}
        </p>

        <p className="text-slate-400">
          Position: {player.position || "N/A"}
        </p>
      </div>
    </Link>
  );
}

export default PlayerCard;