import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPlayer } from "../services/nbaApi";

function PlayerPage() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlayer() {
      try {
        const playerData = await getPlayer(id);
        setPlayer(playerData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadPlayer();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <p className="text-slate-400">Loading player...</p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <p className="text-slate-400">Player not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <Link to="/" className="text-blue-400 hover:underline">
        ← Back to Dashboard
      </Link>

      <div className="mt-8 rounded-2xl bg-slate-900 border border-slate-800 p-8 max-w-2xl">
        <h1 className="text-4xl font-bold">
          {player.first_name} {player.last_name}
        </h1>

        <p className="text-slate-400 mt-2">
          {player.team?.full_name}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <p>Position: {player.position || "N/A"}</p>
          <p>Height: {player.height || "N/A"}</p>
          <p>Weight: {player.weight || "N/A"}</p>
          <p>Jersey: {player.jersey_number || "N/A"}</p>
          <p>Conference: {player.team?.conference || "N/A"}</p>
          <p>Division: {player.team?.division || "N/A"}</p>
        </div>
      </div>
    </div>
  );
}

export default PlayerPage;