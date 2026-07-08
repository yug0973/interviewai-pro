import { FileText, Mic, BarChart3, MessagesSquare, ArrowRight } from "lucide-react"
import { SignalBackground } from "@/components/layout/SignalBackground"
import { SignalDivider } from "@/components/layout/SignalDivider"
import { Nav } from "@/components/layout/Nav"
import { Link } from "react-router-dom"

const STEPS = [
  {
    index: "01",
    label: "UPLOAD_RESUME",
    title: "Upload a resume, get an honest score",
    body: "We read it the way an ATS does: role match, missing keywords, formatting that gets you filtered out before a human ever sees it.",
  },
  {
    index: "02",
    label: "LIVE_SESSION",
    title: "Answer questions that adapt to you",
    body: "Type or talk. Every follow-up is built from what you just said, not pulled from a fixed script you've seen before.",
  },
  {
    index: "03",
    label: "REVIEW_SCORE",
    title: "See exactly where you lost points",
    body: "A score per answer, strengths, gaps, and one clear read on what to fix before the interview that actually counts.",
  },
]

const FEATURES = [
  {
    icon: FileText,
    title: "ATS analysis",
    body: "Skills, experience level, and the keywords your resume is missing for the role you want.",
  },
  {
    icon: MessagesSquare,
    title: "Adaptive interview",
    body: "Follow-up questions generated from your last answer — every session is genuinely different.",
  },
  {
    icon: Mic,
    title: "Voice or text",
    body: "Talk it out loud like a real interview, or type if that's how you think best.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Track your ATS score and interview scores over time, and see your recurring skill gaps.",
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-void">
      <SignalBackground className="min-h-screen">
        <Nav />
        <div className="mx-auto flex max-w-5xl flex-col px-6 pb-24 pt-16 sm:px-10 sm:pt-24">
          <span className="font-mono text-[12px] tracking-[0.2em] text-alert">
            &gt; ADAPTIVE_MOCK_INTERVIEWS
          </span>
          <h1 className="mt-6 max-w-3xl font-display text-4xl font-medium leading-[1.08] tracking-tight text-signal sm:text-6xl">
            You're not practicing for an interview.
            <br />
            You're practicing for this one.
          </h1>
          <p className="mt-6 max-w-xl text-balance font-body text-lg leading-relaxed text-static">
            Upload your resume. Get matched questions for the role. Answer out loud or type it
            out. See exactly where you lost points.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-sm bg-alert px-6 py-3 font-mono text-[13px] uppercase tracking-[0.12em] text-void transition-transform hover:scale-[1.02]"
            >
              Start practicing
              <ArrowRight size={16} />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-sm border border-line-strong px-6 py-3 font-mono text-[13px] uppercase tracking-[0.12em] text-signal transition-colors hover:border-signal"
            >
              See how scoring works
            </a>
          </div>
        </div>
      </SignalBackground>

      <SignalDivider label="&gt; LIVE_SIGNAL" />

      <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-24 sm:px-10">
        <h2 className="font-display text-2xl font-medium tracking-tight text-signal sm:text-3xl">
          Three steps, in order
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.index} className="bg-surface p-8">
              <span className="font-mono text-sm text-alert">{step.index}</span>
              <div className="mt-4 font-mono text-[11px] tracking-[0.18em] text-static-dim uppercase">
                {step.label}
              </div>
              <h3 className="mt-3 font-display text-lg font-medium text-signal">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-static">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <SignalDivider />

      <section className="mx-auto max-w-5xl px-6 py-24 sm:px-10">
        <h2 className="font-display text-2xl font-medium tracking-tight text-signal sm:text-3xl">
          What's actually in it
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-md border border-line bg-surface p-6 transition-colors hover:border-line-strong"
            >
              <Icon size={20} className="text-alert" strokeWidth={1.75} />
              <h3 className="mt-4 font-display text-base font-medium text-signal">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-static">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <span className="font-display text-sm text-signal">
            InterviewAI<span className="text-alert">.</span>Pro
          </span>
          <span className="font-mono text-[11px] tracking-[0.1em] text-static-dim">
            &gt; SESSION_READY
          </span>
        </div>
      </footer>
    </div>
  )
}
