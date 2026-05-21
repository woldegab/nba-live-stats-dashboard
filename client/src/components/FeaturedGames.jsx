import GameCard from "./GameCard";

function FeaturedGames({ games }) {
  const featuredGames = games.slice(0, 2);

  return (
    <section className="mb-12">
      <div className="mb-6">
        <p className="text-blue-400 font-semibold">
          Featured
        </p>

        <h2 className="text-2xl font-bold">
          Today&apos;s Featured Games
        </h2>
      </div>

      {featuredGames.length === 0 ? (
        <p className="text-slate-400">
          No featured games available.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {featuredGames.map((game) => (
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
  );
}

export default FeaturedGames;