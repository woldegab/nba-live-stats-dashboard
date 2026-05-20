import { useEffect, useState } from "react";
import GameCard from "./components/GameCard";
import { getGames } from "./services/nbaApi";

function App() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGames() {
      try {
        const gameData = await getGames();
        setGames(gameData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadGames();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-8 py-5">
        <h1 className="text-2xl font-bold">NBA Live Stats Dashboard</h1>
        <p className="text-slate-400">
          Live games, player stats, and team analytics
        </p>
      </nav>

      <main className="p-8">
        <h2 className="text-xl font-semibold mb-6">Live NBA Games</h2>

        {loading ? (
          <p className="text-slate-400">Loading games...</p>
        ) : games.length === 0 ? (
          <p className="text-slate-400">No games scheduled today.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {games.map((game) => (
              <GameCard
                key={game.id}
                homeTeam={game.home_team}
                visitorTeam={game.visitor_team}
                homeScore={game.home_team_score}
                visitorScore={game.visitor_team_score}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;