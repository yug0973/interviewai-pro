import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { SignalBackground } from "@/components/layout/SignalBackground"

interface AuthShellProps {
  eyebrow: string
  title: string
  children: ReactNode
  footer: ReactNode
}

/**
 * Shared frame for Login/Signup: the same live-shader hero treatment as the
 * landing page, with a glass card floated on top. Keeps the "always
 * listening" motif present even on utility screens, not just the homepage.
 */
export function AuthShell({ eyebrow, title, children, footer }: AuthShellProps) {
  return (
    <SignalBackground className="min-h-screen">
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <Link
          to="/"
          className="mb-10 font-display text-lg font-medium tracking-tight text-signal"
        >
          InterviewAI<span className="text-alert">.</span>Pro
        </Link>

        <div className="w-full max-w-sm rounded-2xl border border-line-strong bg-surface/70 p-8 shadow-2xl backdrop-blur-md">
          <span className="font-mono text-[11px] tracking-[0.2em] text-alert">{eyebrow}</span>
          <h1 className="mt-3 font-display text-2xl font-medium text-signal">{title}</h1>

          <div className="mt-6">{children}</div>
        </div>

        <div className="mt-6 font-mono text-[13px] text-static">{footer}</div>
      </div>
    </SignalBackground>
  )
}
