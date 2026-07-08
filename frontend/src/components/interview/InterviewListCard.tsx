import { Link } from "react-router-dom";
import { MessagesSquare, ChevronRight } from "lucide-react";
import type { InterviewSession } from "@/lib/api";

interface InterviewListCardProps {
  sessions: InterviewSession[];
}

export function InterviewListCard({ sessions }: InterviewListCardProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="mx-auto grid size-12 place-content-center rounded-2xl bg-void text-static">
          <MessagesSquare size={24} />
        </div>
        <h3 className="mt-4 font-display text-base font-semibold text-signal">No practice sessions yet</h3>
        <p className="mt-1.5 text-xs text-static">
          Start your first mock interview on the left to simulate real technical rounds.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-signal">Interview History</h2>
          <p className="mt-0.5 text-xs text-static">Review past mock interviews and evaluation scores.</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {sessions.map((session) => {
          const isCompleted = session.status === "COMPLETED";
          const isInProgress = session.status === "IN_PROGRESS";

          return (
            <Link
              key={session.id}
              to={`/interviews/${session.id}`}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-line-strong bg-void p-4 transition-all hover:border-static-dim"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-signal group-hover:text-alert transition-colors">
                    {session.targetRole}
                  </p>
                  <span className="shrink-0 rounded-full border border-line-strong bg-surface px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-static">
                    {session.mode}
                  </span>
                </div>

                <p className="mt-1 font-mono text-xs text-static-dim">
                  {session.difficulty} · {session.totalQuestions} questions ·{" "}
                  {new Date(session.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line">
                {session.overallScore != null ? (
                  <div className="text-right">
                    <span className="font-mono text-[10px] uppercase text-static block">Score</span>
                    <span className="font-display text-lg font-bold text-alert">
                      {session.overallScore}/100
                    </span>
                  </div>
                ) : null}

                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider font-semibold border ${
                    isCompleted
                      ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-400"
                      : isInProgress
                        ? "border-amber-500/30 bg-amber-950/30 text-amber-400"
                        : "border-line bg-surface text-static-dim"
                  }`}
                >
                  {session.status.replace("_", " ")}
                </span>

                <ChevronRight size={16} className="text-static group-hover:text-signal transition-colors hidden sm:block" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
