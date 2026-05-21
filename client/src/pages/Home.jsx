import { useEffect, useState } from "react";
import GameCard from "../components/GameCard";
import PlayerCard from "../components/PlayerCard";
import { getGames, searchPlayers } from "../services/nbaApi";

function Home() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [players, setPlayers] = useState([]);

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

  async function handleSearch() {
    if (!searchTerm.trim()) return;

    const playerData = await searchPlayers(searchTerm);
    setPlayers(playerData);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-8 py-5">
        <h1 className="text-2xl font-bold">NBA Live Stats Dashboard</h1>
        <p className="text-slate-400">
          Live games, player stats, and team analytics
        </p>
      </nav>

      <main className="p-8">
        <section>
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
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-4">Player Search</h2>

          <div className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Search player..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 w-full max-w-md"
            />

            <button
              onClick={handleSearch}
              className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-lg font-semibold"
            >
              Search
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {players.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;