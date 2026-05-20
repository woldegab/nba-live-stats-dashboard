function PlayerCard({ player }) {
    return (
      <div className="rounded-xl bg-slate-900 p-6 border border-slate-800 hover:border-blue-500 transition">
        <h3 className="text-xl font-bold">
          {player.first_name} {player.last_name}
        </h3>
  
        <p className="text-slate-400 mt-2">
          Team: {player.team?.full_name || "Unknown"}
        </p>
  
        <p className="text-slate-400">
          Position: {player.position || "N/A"}
        </p>
      </div>
    );
  }
  
  export default PlayerCard;