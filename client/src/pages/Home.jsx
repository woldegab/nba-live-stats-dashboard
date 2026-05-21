import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import FeaturedGames from "../components/FeaturedGames";
import GameCard from "../components/GameCard";
import PlayerCard from "../components/PlayerCard";
import { getGames, searchPlayers } from "../services/nbaApi";


function Home() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [players, setPlayers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    let intervalId;

    async function loadGames() {
      try {
        const gameData = await getGames();

        setGames(gameData);
        setLastUpdated(new Date());

        const hasLiveGames = gameData.some((game) =>
          game.status?.toLowerCase().includes("q")
        );

        clearInterval(intervalId);

        intervalId = setInterval(
          loadGames,
          hasLiveGames ? 10000 : 60000
        );
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadGames();

    return () => clearInterval(intervalId);
  }, []);

  async function handleSearch() {
    if (!searchTerm.trim()) return;

    setSearchLoading(true);
    setSearchError("");

    try {
      const playerData = await searchPlayers(searchTerm);

      setPlayers(playerData);

      if (playerData.length === 0) {
        setSearchError("No players found.");
      }
    } catch (error) {
      console.error(error);
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  }

  const featuredGames = games.slice(0, 2);
  const remainingGames = games.slice(2);

  const hasLiveGames = games.some((game) =>
    game.status?.toLowerCase().includes("q")
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <main className="p-8">
        <div className="mb-6 flex items-center gap-4 text-sm text-slate-400">
          <p>
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : "Loading latest scores..."}
          </p>

          {hasLiveGames && (
            <span className="text-red-400 font-semibold animate-pulse">
              Auto-refreshing live scores
            </span>
          )}
        </div>

        {!loading && <FeaturedGames games={featuredGames} />}

        <section>
          <h2 className="text-xl font-semibold mb-6">
            Other Games Today
          </h2>

          {loading ? (
            <p className="text-slate-400">
              Loading games...
            </p>
          ) : remainingGames.length === 0 ? (
            <p className="text-slate-400">
              No other games scheduled today.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {remainingGames.map((game) => (
                <GameCard
                  key={game.id}
                  homeTeam={game.home_team}
                  visitorTeam={game.visitor_team}
                  homeScore={game.home_team_score}
                  visitorScore={game.visitor_team_score}
                  status={game.status}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-4">
            Player Search
          </h2>

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

          {searchLoading && (
            <p className="text-slate-400 mb-4">
              Searching players...
            </p>
          )}

          {searchError && (
            <p className="text-red-400 mb-4">
              {searchError}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;