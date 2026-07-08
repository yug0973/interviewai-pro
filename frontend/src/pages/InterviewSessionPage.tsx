import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AnswerInput } from "@/components/interview/AnswerInput";
import { TurnFeedback } from "@/components/interview/TurnFeedback";
import { SessionSummary } from "@/components/interview/SessionSummary";
import {
  interviewSessionApi,
  type InterviewSessionDetail,
  type InterviewQuestion,
  ApiError,
} from "@/lib/api";
import { useToast } from "@/lib/toast";

export default function InterviewSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState<InterviewSessionDetail | null>(null);
  const [lastAnswered, setLastAnswered] = useState<InterviewQuestion | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    interviewSessionApi
      .get(id)
      .then((res) => {
        setSession(res.session);
        const answered = res.session.questions?.filter((q) => q.answerText != null && q.score != null);
        if (answered?.length) {
          setLastAnswered(answered[answered.length - 1]);
        }
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load this interview session.")
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAnswer(answerText: string) {
    if (!id || !currentQuestion) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await interviewSessionApi.answer(id, answerText);
      const answeredQuestion = res.session.questions?.find((q) => q.id === currentQuestion.id);
      setLastAnswered(answeredQuestion ?? null);
      setSession(res.session);
      toast.success("Answer evaluated!", "Calibrated feedback generated.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't submit your answer. Please try again.";
      setError(msg);
      toast.error("Submission failed", msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAbandon() {
    if (!id || !confirm("Are you sure you want to abandon this session? Progress will be saved as incomplete.")) return;
    try {
      await interviewSessionApi.abandon(id);
      toast.info("Session abandoned");
      navigate("/interviews");
    } catch {
      toast.error("Couldn't abandon session");
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-alert border-t-transparent" />
            <span className="font-mono text-xs uppercase tracking-widest text-static">
              Loading Interview Simulator…
            </span>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !session) {
    return (
      <DashboardShell>
        <div className="rounded-2xl border border-line bg-surface p-8 text-center space-y-4">
          <p className="text-sm text-rose-400">{error || "Session not found."}</p>
          <Link
            to="/interviews"
            className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 font-mono text-xs uppercase tracking-wider text-signal hover:bg-surface-raised"
          >
            <ChevronLeft size={14} /> Back to Interviews
          </Link>
        </div>
      </DashboardShell>
    );
  }

  if (session.status === "COMPLETED") {
    return (
      <DashboardShell>
        <SessionSummary session={session} />
      </DashboardShell>
    );
  }

  const currentQuestion = session.questions.find((q) => q.answerText == null) ?? null;
  const currentStep = currentQuestion?.order ?? session.questions.length;
  const progressPercent = Math.round(((currentStep - 1) / session.totalQuestions) * 100);

  return (
    <DashboardShell>
      {/* Top Header & Progress Bar */}
      <div className="pb-6 border-b border-line space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold text-signal">{session.targetRole}</h1>
              <span className="rounded-full border border-alert/30 bg-alert/10 px-2.5 py-0.5 font-mono text-[10px] uppercase font-semibold text-alert">
                {session.difficulty}
              </span>
              <span className="rounded-full border border-line-strong bg-void px-2.5 py-0.5 font-mono text-[10px] uppercase text-static">
                {session.mode} Mode
              </span>
            </div>
            <p className="mt-1 text-xs text-static font-mono">
              Question {currentStep} of {session.totalQuestions}
            </p>
          </div>

          <button
            onClick={handleAbandon}
            className="font-mono text-xs uppercase tracking-wider text-static-dim hover:text-rose-400 transition-colors"
          >
            Abandon Session
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
          <div
            className="h-full rounded-full bg-alert transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-3xl space-y-6">
        {/* Previous Answer Turn Feedback */}
        {lastAnswered ? <TurnFeedback question={lastAnswered} /> : null}

        {/* Current Active Question Card */}
        {currentQuestion ? (
          <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-alert">
                  {currentQuestion.isFollowUp ? "Adaptive Follow-up" : `Question #${currentQuestion.order}`}
                </span>
                <span className="font-mono text-xs text-static-dim">
                  Category: {currentQuestion.category}
                </span>
              </div>

              <h2 className="mt-3 font-display text-xl font-medium leading-snug text-signal">
                {currentQuestion.questionText}
              </h2>
            </div>

            <div className="border-t border-line pt-6">
              <AnswerInput
                mode={session.mode as "TEXT" | "VOICE"}
                onSubmit={handleAnswer}
                submitting={submitting}
              />
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>
    </DashboardShell>
  );
}
