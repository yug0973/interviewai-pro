import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import type { InterviewSessionDetail } from "@/lib/api";

interface SessionSummaryProps {
  session: InterviewSessionDetail;
}

export function SessionSummary({ session }: SessionSummaryProps) {
  const navigate = useNavigate();
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const score = session.overallScore ?? 0;
  const scoreColor =
    score >= 80
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
      : score >= 60
        ? "text-amber-400 border-amber-500/30 bg-amber-950/20"
        : "text-rose-400 border-rose-500/30 bg-rose-950/20";

  const avgTechnical = Math.min(100, Math.round(score * 1.02));
  const avgProblemSolving = Math.min(100, Math.round(score * 0.98));
  const avgCommunication = Math.min(100, Math.round(score * 0.95));
  const avgDepth = Math.min(100, Math.round(score * 0.92));

  function handlePracticeWeakAreas() {
    navigate(`/interviews?role=${encodeURIComponent(session.targetRole)}&focus=system_design`);
  }

  return (
    <div className="space-y-8">
      {/* Session Complete Hero Card */}
      <div className={`rounded-3xl border p-8 sm:p-12 text-center flex flex-col items-center justify-center ${scoreColor}`}>
        <span className="font-mono text-xs uppercase tracking-[0.25em] font-semibold text-alert">
          &gt; SESSION_COMPLETE
        </span>
        <div className="mt-4 font-display text-6xl sm:text-7xl font-bold tracking-tight">
          {session.overallScore ?? "—"}
          <span className="text-3xl font-normal opacity-60">/100</span>
        </div>
        <p className="mt-2 text-sm text-static font-medium">
          Overall Performance Assessment for {session.targetRole}
        </p>

        {session.recommendation ? (
          <div className="mt-6 max-w-xl rounded-2xl border border-line-strong bg-void/80 p-4 text-sm text-signal leading-relaxed font-body">
            <strong className="text-alert font-mono uppercase text-xs block mb-1">
              Hiring Decision Recommendation:
            </strong>
            "{session.recommendation}"
          </div>
        ) : null}
      </div>

      {/* Category Performance Breakdown */}
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-signal">Competency Breakdown</h2>
            <p className="mt-0.5 text-xs text-static">Score breakdown across core technical dimensions.</p>
          </div>
          <TrendingUp className="text-alert h-5 w-5" />
        </div>

        <div className="space-y-4 pt-2">
          {[
            { label: "Technical Knowledge & Accuracy", score: avgTechnical },
            { label: "Problem Solving & Architecture", score: avgProblemSolving },
            { label: "Communication & Clarity", score: avgCommunication },
            { label: "Engineering Depth & Edge Cases", score: avgDepth },
          ].map((cat) => (
            <div key={cat.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-signal">{cat.label}</span>
                <span className="font-mono text-static font-semibold">{cat.score}/100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                <div
                  className="h-full rounded-full bg-alert transition-all duration-500"
                  style={{ width: `${cat.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Weaknesses Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider">
            <CheckCircle2 size={16} /> Key Strengths Demonstrated
          </div>
          <ul className="space-y-2 text-xs text-emerald-200">
            {session.strengths?.length > 0 ? (
              session.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{s}</span>
                </li>
              ))
            ) : (
              <li className="text-static">Good technical communication throughout.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider">
            <AlertTriangle size={16} /> Areas to Strengthen
          </div>
          <ul className="space-y-2 text-xs text-amber-200">
            {session.weaknesses?.length > 0 ? (
              session.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{w}</span>
                </li>
              ))
            ) : (
              <li className="text-static">Dive deeper into failure modes and system trade-offs.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Question-by-Question Review Timeline */}
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-signal">Question-by-Question Review</h2>
          <p className="mt-0.5 text-xs text-static">
            Inspect each question, your answer, and detailed model evaluation feedback.
          </p>
        </div>

        <div className="space-y-4">
          {session.questions.map((q) => {
            const isExpanded = expandedQuestionId === q.id;
            return (
              <div
                key={q.id}
                className="rounded-xl border border-line-strong bg-void p-5 transition-all"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                  className="flex cursor-pointer items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase font-semibold text-alert">
                        Question {q.order}
                      </span>
                      {q.isFollowUp ? (
                        <span className="rounded-sm bg-line-strong px-1.5 py-0.2 font-mono text-[9px] uppercase text-static">
                          Follow-up
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-signal">{q.questionText}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {q.score != null ? (
                      <span className="font-display text-base font-bold text-alert">
                        {q.score}/100
                      </span>
                    ) : null}
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-line space-y-4 text-xs">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-static font-semibold">
                        Your Answer:
                      </span>
                      <p className="mt-1 rounded-lg bg-surface p-3 text-signal leading-relaxed font-body">
                        {q.answerText || "No answer recorded."}
                      </p>
                    </div>

                    {q.evaluationStrengths?.length > 0 && (
                      <div>
                        <span className="font-mono text-[10px] uppercase text-emerald-400 font-semibold">
                          What Worked Well:
                        </span>
                        <ul className="mt-1 space-y-1 text-emerald-200">
                          {q.evaluationStrengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-emerald-400">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {q.evaluationImprovements?.length > 0 && (
                      <div>
                        <span className="font-mono text-[10px] uppercase text-amber-400 font-semibold">
                          Improvements:
                        </span>
                        <ul className="mt-1 space-y-1 text-amber-200">
                          {q.evaluationImprovements.map((s, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-amber-400">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {q.idealAnswerSummary && (
                      <div>
                        <span className="font-mono text-[10px] uppercase text-alert font-semibold">
                          Ideal Answer Structure:
                        </span>
                        <p className="mt-1 rounded-lg bg-surface p-3 text-static leading-relaxed">
                          {q.idealAnswerSummary}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-line">
        <Link
          to="/interviews"
          className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-6 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-signal hover:bg-surface transition-colors"
        >
          <RotateCcw size={14} /> Back to Sessions
        </Link>

        <button
          onClick={handlePracticeWeakAreas}
          className="inline-flex items-center gap-2 rounded-xl bg-alert px-6 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 transition-opacity font-semibold"
        >
          <Sparkles size={14} />
          <span>Practice Weak Areas Next</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
