import { Link, Outlet, useLocation } from "react-router-dom";

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-[#222] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link to="/" className="text-lg font-black tracking-tight sm:text-xl">
            Video Club
          </Link>
          <nav className="flex gap-4 text-sm text-[#888]">
            <Link
              to="/rules"
              className={location.pathname === "/rules" ? "text-white" : "hover:text-white"}
            >
              Rules
            </Link>
            <Link
              to="/about"
              className={location.pathname === "/about" ? "text-white" : "hover:text-white"}
            >
              About
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>
      <footer className="border-t border-[#222] px-4 py-6 text-center text-xs text-[#666]">
        Rank is the videos. Real founder. Real product link. No AI.
      </footer>
    </div>
  );
}
