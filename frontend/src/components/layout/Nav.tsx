import { Link } from "react-router-dom"

export function Nav() {
  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10">
      <Link to="/" className="font-display text-lg font-medium tracking-tight text-signal">
        InterviewAI<span className="text-alert">.</span>Pro
      </Link>
      <nav className="flex items-center gap-6">
        <a
          href="#how-it-works"
          className="hidden font-mono text-[13px] uppercase tracking-[0.12em] text-static transition-colors hover:text-signal sm:inline"
        >
          How it works
        </a>
        <Link
          to="/login"
          className="font-mono text-[13px] uppercase tracking-[0.12em] text-static transition-colors hover:text-signal"
        >
          Log in
        </Link>
        <Link
          to="/signup"
          className="rounded-sm border border-alert bg-alert/10 px-4 py-2 font-mono text-[13px] uppercase tracking-[0.12em] text-alert transition-colors hover:bg-alert hover:text-void"
        >
          Start practicing
        </Link>
      </nav>
    </header>
  )
}
