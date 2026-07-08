import { useState } from "react";
import { CheckCircle2, AlertTriangle, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import type { InterviewQuestion } from "@/lib/api";

interface TurnFeedbackProps {
  question: InterviewQuestion;
}

export function TurnFeedback({ question }: TurnFeedbackProps) {
  const [showIdealAnswer, setShowIdealAnswer] = useState(false);

  if (question.score == null) return null;

  const score = question.score;
  const scoreBadgeColor =
    score >= 80
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
      : score >= 50
        ? "text-amber-400 border-amber-500/30 bg-amber-950/20"
        : "text-rose-400 border-rose-500/30 bg-rose-950/20";

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-alert font-semibold">
            Turn {question.order} Feedback
          </span>
          <p className="mt-0.5 text-xs text-static font-mono">Calibrated Answer Evaluation</p>
        </div>

        <div className={`rounded-xl border px-4 py-1.5 font-display text-lg font-bold ${scoreBadgeColor}`}>
          {score}
          <span className="text-xs font-normal opacity-70">/100</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {question.evaluationStrengths?.length > 0 ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider">
              <CheckCircle2 size={14} /> What Worked Well
            </div>
            <ul className="space-y-1.5 text-xs text-emerald-200">
              {question.evaluationStrengths.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {question.evaluationImprovements?.length > 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider">
              <AlertTriangle size={14} /> Improvement Gaps
            </div>
            <ul className="space-y-1.5 text-xs text-amber-200">
              {question.evaluationImprovements.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {question.idealAnswerSummary && (
        <div className="rounded-xl border border-line-strong bg-void p-4">
          <button
            type="button"
            onClick={() => setShowIdealAnswer(!showIdealAnswer)}
            className="flex w-full items-center justify-between text-xs font-medium text-signal hover:text-alert transition-colors"
          >
            <div className="flex items-center gap-2 font-mono uppercase tracking-wider text-static">
              <Lightbulb size={14} className="text-alert" />
              <span>Model Ideal Answer Structure</span>
            </div>
            {showIdealAnswer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showIdealAnswer && (
            <p className="mt-3 text-xs leading-relaxed text-static border-t border-line pt-3 font-body">
              {question.idealAnswerSummary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
