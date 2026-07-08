import { Link } from "react-router-dom"

interface PlaceholderPageProps {
  title: string
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-void px-6 text-center">
      <span className="font-mono text-[12px] tracking-[0.2em] text-alert">&gt; NOT_BUILT_YET</span>
      <h1 className="font-display text-2xl font-medium text-signal">{title}</h1>
      <p className="max-w-sm text-sm leading-relaxed text-static">
        This screen isn't built yet. The landing page is the only one wired up so far.
      </p>
      <Link
        to="/"
        className="mt-2 font-mono text-[13px] uppercase tracking-[0.12em] text-alert hover:text-signal"
      >
        Back home
      </Link>
    </div>
  )
}
