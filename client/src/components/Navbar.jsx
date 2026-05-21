import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="border-b border-slate-800 px-8 py-5 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">NBA Live Stats Dashboard</h1>
        <p className="text-slate-400">
          Live games, player stats, and team analytics
        </p>
      </div>

      <div className="flex gap-6 text-slate-300">
        <Link to="/" className="hover:text-white">
          Home
        </Link>

        <Link to="/" className="hover:text-white">
          Players
        </Link>

        <Link to="/" className="hover:text-white">
          Teams
        </Link>

        <Link to="/" className="hover:text-white">
          Standings
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;