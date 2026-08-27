import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import type { BoardPeriod } from "../lib/api";

export function Layout() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const period: BoardPeriod = searchParams.get("period") === "today" ? "today" : "all";

  const linkClass = (path: string) =>
    location.pathname === path
      ? "font-medium text-[#111]"
      : "text-[#6b7280] transition hover:text-[#111]";

  const setPeriod = (next: BoardPeriod) => {
    const params = new URLSearchParams(searchParams);
    if (next === "today") params.set("period", "today");
    else params.delete("period");
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#111]">
      <header className="border-b border-[#e8e4df] bg-[#faf8f5]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111] text-sm text-white">
              ▶
            </span>
            videoclub.lol
          </Link>

          {location.pathname === "/" && (
            <div className="order-last flex w-full justify-center sm:order-none sm:w-auto">
              <div className="inline-flex rounded-full border border-[#e8e4df] bg-white p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setPeriod("all")}
                  className={`rounded-full px-4 py-1.5 font-medium transition ${
                    period === "all" ? "bg-[#111] text-white" : "text-[#6b7280] hover:text-[#111]"
                  }`}
                >
                  All-time
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("today")}
                  className={`rounded-full px-4 py-1.5 font-medium transition ${
                    period === "today" ? "bg-[#111] text-white" : "text-[#6b7280] hover:text-[#111]"
                  }`}
                >
                  Today
                </button>
              </div>
            </div>
          )}

          <nav className="flex items-center gap-5 text-sm">
            <Link to="/" className={linkClass("/")}>
              Leaderboard
            </Link>
            <Link to="/feed" className={linkClass("/feed")}>
              Feed
            </Link>
            <Link to="/rules" className={linkClass("/rules")}>
              Rules
            </Link>
            <Link to="/about" className={linkClass("/about")}>
              About
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet context={{ period }} />
      </main>

      <footer className="border-t border-[#e8e4df] px-4 py-8 text-center text-sm text-[#6b7280]">
        <p className="font-medium text-[#111]">Rank is the videos — nothing else.</p>
        <p className="mt-2">
          <Link to="/feed" className="hover:text-[#f4623a]">
            Feed
          </Link>
          {" · "}
          <Link to="/rules" className="hover:text-[#f4623a]">
            Rules
          </Link>
          {" · "}
          <Link to="/about" className="hover:text-[#f4623a]">
            About
          </Link>
        </p>
      </footer>
    </div>
  );
}
