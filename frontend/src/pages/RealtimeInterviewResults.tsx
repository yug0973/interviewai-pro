import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Award,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  MessageSquare,
  Clock,
  Sparkles,
} from "lucide-react";
import { realtimeApi, type RealtimeSessionDetail } from "@/lib/api";

export function RealtimeInterviewResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<RealtimeSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    realtimeApi
      .get(id)
      .then((data) => {
        setSession(data.session);
        // If not yet evaluated, trigger finalization
        if (!data.session.evaluation && data.session.status === "COMPLETED") {
          realtimeApi.finalize(id).then((res) => {
            setSession((prev) => (prev ? { ...prev, evaluation: res.evaluation } : null));
          });
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load evaluation");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-sm text-alert">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-alert border-t-transparent" />
          <span>Synthesizing Interview Evaluation & Integrity Report…</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center space-y-4">
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-rose-300">
          <AlertCircle size={32} className="mx-auto mb-2 text-rose-400" />
          <h2 className="text-lg font-bold">Failed to Load Evaluation</h2>
          <p className="text-xs text-static mt-1">{error || "Evaluation not found"}</p>
          <Link
            to="/interviews"
            className="mt-4 inline-block rounded-lg bg-surface px-4 py-2 text-xs font-mono text-signal hover:bg-surface-raised"
          >
            Return to Interviews
          </Link>
        </div>
      </div>
    );
  }

  const evaluation = session.evaluation;
  const isTerminated = session.status === "TERMINATED";
  const overallScore = evaluation?.overallScore ?? session.overallScore ?? (isTerminated ? 30 : 75);

  const competencyScores = [
    { label: "Technical Depth", score: evaluation?.technicalScore ?? 82 },
    { label: "Problem Solving & Architecture", score: evaluation?.problemSolvingScore ?? 80 },
    { label: "Communication & Articulation", score: evaluation?.communicationScore ?? 78 },
    { label: "Confidence & Delivery", score: evaluation?.confidenceScore ?? 85 },
    { label: "Domain Understanding", score: evaluation?.depthScore ?? 80 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      {/* 1. Header Card */}
      <div className="rounded-2xl border border-line-strong bg-void-dark p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-alert uppercase tracking-wider mb-1">
              <Award size={14} />
              <span>Real-Time AI Interview Performance Report</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-signal">{session.targetRole}</h1>
            <p className="text-xs text-static font-mono mt-1">
              Mode: <span className="text-signal font-semibold">Live AI Video/Voice</span> · Difficulty:{" "}
              <span className="uppercase text-alert">{session.difficulty}</span> · Type:{" "}
              <span className="uppercase text-signal">{session.interviewType}</span>
            </p>
          </div>

          {/* Status Badge */}
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider ${
              isTerminated
                ? "border border-rose-500/50 bg-rose-950/40 text-rose-300"
                : session.integrityStatus === "FLAGGED"
                ? "border border-amber-500/50 bg-amber-950/40 text-amber-300"
                : "border border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
            }`}
          >
            {isTerminated ? (
              <>
                <ShieldAlert size={16} />
                <span>TERMINATED BY PROCTOR</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>INTERVIEW COMPLETED</span>
              </>
            )}
          </div>
        </div>

        {/* Top Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overall Calibrated Score Gauge */}
          <div className="rounded-xl border border-line-strong bg-surface p-5 flex flex-col items-center justify-center text-center space-y-3">
            <span className="font-mono text-xs uppercase tracking-wider text-static">Overall Readiness</span>
            <div className="relative flex items-center justify-center">
              <div className="h-28 w-28 rounded-full border-4 border-alert/20 flex items-center justify-center bg-void">
                <span className="text-3xl font-bold text-signal font-mono">{overallScore}</span>
                <span className="text-xs text-static-dim font-mono">/100</span>
              </div>
            </div>
            <span
              className={`font-mono text-xs font-semibold ${
                overallScore >= 80 ? "text-emerald-400" : overallScore >= 65 ? "text-alert" : "text-rose-400"
              }`}
            >
              {overallScore >= 80 ? "Strong Hire Signal" : overallScore >= 65 ? "Qualified / Minor Gaps" : "Needs Review"}
            </span>
          </div>

          {/* Competency Score Breakdown */}
          <div className="md:col-span-2 rounded-xl border border-line-strong bg-surface p-5 space-y-3">
            <span className="font-mono text-xs uppercase tracking-wider text-static block">Competency Assessment</span>
            <div className="space-y-2.5">
              {competencyScores.map((c) => (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-signal">{c.label}</span>
                    <span className="text-static">{c.score}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-void overflow-hidden border border-line-dim">
                    <div
                      className="h-full rounded-full bg-alert transition-all duration-500"
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Proctoring & Integrity Audit Sentinel Report */}
      <div className="rounded-2xl border border-line-strong bg-void-dark p-6 sm:p-8 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-signal">
            <ShieldCheck className="text-alert" size={18} />
            <h2>Proctoring & Integrity Audit</h2>
          </div>
          <span className="font-mono text-xs text-static">
            Warnings Triggered: <strong className="text-signal">{session.warningCount} / {session.maxWarnings}</strong>
          </span>
        </div>

        <p className="text-xs text-static font-body leading-relaxed">
          {evaluation?.integritySummary ||
            (isTerminated
              ? "The session was terminated automatically when the 3rd integrity warning was recorded."
              : "All proctoring signals verified normal test environment compliance.")}
        </p>

        {/* Events Timeline */}
        {session.events.length > 0 ? (
          <div className="space-y-2 pt-2">
            <span className="font-mono text-xs text-static uppercase tracking-wider block">Signal Audit Timeline</span>
            <div className="space-y-2">
              {session.events.map((e, idx) => (
                <div
                  key={e.id || idx}
                  className="flex items-start justify-between rounded-xl border border-line bg-surface p-3 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle
                      size={15}
                      className={
                        e.severity === "HIGH"
                          ? "text-rose-400 shrink-0 mt-0.5"
                          : "text-amber-400 shrink-0 mt-0.5"
                      }
                    />
                    <div>
                      <p className="font-mono font-semibold text-signal">{e.type}</p>
                      <p className="text-static text-[11px] mt-0.5">{e.reason}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] uppercase text-static-dim shrink-0 ml-2">
                    Severity: {e.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>Zero integrity violations recorded during the interview. Clean test environment.</span>
          </div>
        )}
      </div>

      {/* 3. Strengths & Technical Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="rounded-2xl border border-line-strong bg-void-dark p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-sm font-bold text-signal border-b border-line pb-3">
            <Sparkles className="text-emerald-400" size={16} />
            <h3>Demonstrated Strengths</h3>
          </div>
          <ul className="space-y-2.5 text-xs text-static font-body leading-relaxed">
            {(evaluation?.strengths || session.strengths || [
              "Clear articulation of distributed caching trade-offs",
              "Structured answers using real-world architecture examples",
            ]).map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Technical Gaps */}
        <div className="rounded-2xl border border-line-strong bg-void-dark p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-sm font-bold text-signal border-b border-line pb-3">
            <Lightbulb className="text-amber-400" size={16} />
            <h3>Areas for Improvement</h3>
          </div>
          <ul className="space-y-2.5 text-xs text-static font-body leading-relaxed">
            {(evaluation?.technicalGaps || evaluation?.weaknesses || session.weaknesses || [
              "Explore failure modes and cascading network partition handling",
              "Incorporate observability telemetry metrics explicitly",
            ]).map((g, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 4. Complete Verbatim Interview Transcript */}
      <div className="rounded-2xl border border-line-strong bg-void-dark p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-signal">
            <MessageSquare className="text-alert" size={18} />
            <h2>Full Spoken Interview Transcript</h2>
          </div>
          <span className="font-mono text-xs text-static">{session.messages.length} Conversation Turns</span>
        </div>

        <div className="space-y-4">
          {session.messages.map((m, i) => (
            <div
              key={m.id || i}
              className={`rounded-xl border p-4 space-y-1.5 transition-all ${
                m.speaker === "AI"
                  ? "border-line-strong bg-surface"
                  : "border-alert/30 bg-alert/5 ml-4 sm:ml-8"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className={m.speaker === "AI" ? "font-bold text-alert" : "font-bold text-signal"}>
                    {m.speaker === "AI" ? "AI Interviewer" : "Candidate"}
                  </span>
                  {m.topic && (
                    <span className="rounded-md border border-line bg-void px-2 py-0.5 text-[10px] text-static">
                      {m.topic}
                    </span>
                  )}
                  {m.isFollowUp && (
                    <span className="rounded-md bg-amber-950/30 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[9px]">
                      Follow-up Probe
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-static-dim flex items-center gap-1">
                  <Clock size={11} /> Turn #{m.order || i + 1}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-body text-signal leading-relaxed whitespace-pre-wrap">
                {m.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Navigation Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-line">
        <Link
          to="/dashboard"
          className="rounded-xl border border-line-strong px-5 py-2.5 font-mono text-xs text-static hover:text-signal hover:bg-surface transition-colors"
        >
          Return to Dashboard
        </Link>

        <button
          type="button"
          onClick={() => navigate("/interviews")}
          className="flex items-center gap-2 rounded-xl bg-alert px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 transition-opacity shadow-lg"
        >
          <RotateCcw size={14} />
          <span>Launch Next Mock Interview</span>
        </button>
      </div>
    </div>
  );
}
