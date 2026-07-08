import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, ArrowRight, Video, Radio, ShieldCheck } from "lucide-react";
import { interviewSessionApi, realtimeApi, ApiError, type Resume } from "@/lib/api";
import { useToast } from "@/lib/toast";

interface StartInterviewCardProps {
  completedResumes: Resume[];
  initialResumeId?: string;
  initialRole?: string;
}

const DIFFICULTIES = [
  { value: "", label: "Adaptive (Auto)" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;

const FOCUS_AREAS = [
  { value: "mixed", label: "Mixed Architecture & Fundamentals" },
  { value: "system_design", label: "System Design & Scalability" },
  { value: "backend", label: "Backend Architecture & APIs" },
  { value: "dsa", label: "Data Structures & Algorithms" },
  { value: "behavioral", label: "Behavioral & Leadership" },
] as const;

const POPULAR_ROLES = [
  "Backend Engineer",
  "Full Stack Developer",
  "Senior Frontend Engineer",
  "DevOps / SRE",
  "System Architect",
];

export function StartInterviewCard({
  completedResumes,
  initialResumeId = "",
  initialRole = "",
}: StartInterviewCardProps) {
  const navigate = useNavigate();
  const toast = useToast();

  const [interviewFormat, setInterviewFormat] = useState<"REALTIME_VIDEO" | "ASYNC_TEXT">("REALTIME_VIDEO");
  const [resumeId, setResumeId] = useState(initialResumeId);
  const [targetRole, setTargetRole] = useState(initialRole);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "">("");
  const [focus, setFocus] = useState<"mixed" | "dsa" | "backend" | "system_design" | "behavioral">("mixed");
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [mode, setMode] = useState<"TEXT" | "VOICE">("TEXT");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const selectedResume = completedResumes.find((r) => r.id === resumeId);

  async function handleStart() {
    if (!targetRole && !resumeId) {
      setError("Please select a resume or enter a target role.");
      return;
    }
    setStarting(true);
    setError("");

    try {
      if (interviewFormat === "REALTIME_VIDEO") {
        // Create Real-Time Video & Voice Interview Session
        const res = await realtimeApi.create({
          targetRole: targetRole || selectedResume?.targetRole || "Software Engineer",
          interviewType: focus,
          difficulty: difficulty || "medium",
          resumeId: resumeId || undefined,
        });
        toast.success("Live Interview Room ready!", "Prepare your camera and microphone for device verification.");
        navigate(`/interviews/live/${res.session.id}`);
      } else {
        // Standard Questionnaire Session
        const res = await interviewSessionApi.start({
          targetRole: targetRole || undefined,
          resumeId: resumeId || undefined,
          difficulty: difficulty || undefined,
          totalQuestions,
          focus,
          mode,
        });
        toast.success("Interview session ready!", "Good luck with your practice.");
        navigate(`/interviews/${res.session.id}`);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't start the interview. Try again.";
      setError(msg);
      toast.error("Failed to start session", msg);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-signal">Launch AI Mock Interview</h2>
            <span className="rounded-full bg-alert/15 border border-alert/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-alert font-semibold">
              Live & Adaptive
            </span>
          </div>
          <p className="mt-1 text-xs text-static">
            Experience a realistic technical interview with an AI interviewer probing your background in real time.
          </p>
        </div>

        {/* Format Selector Pill */}
        <div className="flex items-center rounded-lg border border-line-strong bg-void p-1 gap-1">
          <button
            type="button"
            onClick={() => setInterviewFormat("REALTIME_VIDEO")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-mono transition-colors ${
              interviewFormat === "REALTIME_VIDEO"
                ? "bg-alert text-void font-bold shadow-xs"
                : "text-static hover:text-signal"
            }`}
          >
            <Video size={13} />
            <span>Live Video/Voice</span>
          </button>
          <button
            type="button"
            onClick={() => setInterviewFormat("ASYNC_TEXT")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-mono transition-colors ${
              interviewFormat === "ASYNC_TEXT"
                ? "bg-surface-raised text-signal font-semibold shadow-xs"
                : "text-static hover:text-signal"
            }`}
          >
            <span>Questionnaire</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {interviewFormat === "REALTIME_VIDEO" && (
          <div className="rounded-xl border border-alert/30 bg-alert/5 p-4 text-xs text-signal flex items-start gap-3">
            <Radio size={18} className="text-alert shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <p className="font-semibold text-alert">Continuous Spoken Video Session</p>
              <p className="text-static text-[11px] leading-relaxed">
                Includes live camera video, microphone voice recognition with true barge-in, mandatory screen sharing, and real-time proctoring integrity monitoring.
              </p>
            </div>
          </div>
        )}

        {/* Resume Selector */}
        {completedResumes.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-static">
              Target Resume & Tech Stack
            </label>
            <select
              value={resumeId}
              onChange={(e) => {
                setResumeId(e.target.value);
                const r = completedResumes.find((res) => res.id === e.target.value);
                if (r?.targetRole && !targetRole) {
                  setTargetRole(r.targetRole);
                }
              }}
              className="rounded-xl border border-line-strong bg-void px-3.5 py-2.5 text-xs text-signal outline-none focus:border-alert transition-colors"
            >
              <option value="">No linked resume (General Practice)</option>
              {completedResumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.targetRole || "General"} · ATS: {r.analysis?.atsScore ?? "N/A"})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Target Role Input & Quick Suggestions */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-xs font-semibold uppercase tracking-wider text-static">
            Target Job Role
          </label>
          <input
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Senior Backend Engineer"
            className="rounded-xl border border-line-strong bg-void px-3.5 py-2.5 text-xs text-signal placeholder-static-dim outline-none focus:border-alert transition-colors"
          />

          <div className="flex flex-wrap gap-1.5 pt-1">
            {POPULAR_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setTargetRole(role)}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                  targetRole === role
                    ? "border-alert bg-alert/15 text-alert font-semibold"
                    : "border-line text-static-dim hover:text-static hover:border-line-strong"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Focus Area & Difficulty Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-static">
              Competency Focus
            </label>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value as any)}
              className="rounded-xl border border-line-strong bg-void px-3.5 py-2.5 text-xs text-signal outline-none focus:border-alert transition-colors"
            >
              {FOCUS_AREAS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-static">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="rounded-xl border border-line-strong bg-void px-3.5 py-2.5 text-xs text-signal outline-none focus:border-alert transition-colors"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {interviewFormat === "ASYNC_TEXT" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-line">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs font-semibold uppercase tracking-wider text-static">
                Input Mode
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("TEXT")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    mode === "TEXT"
                      ? "border-alert bg-alert/15 text-alert font-semibold"
                      : "border-line-strong text-static hover:text-signal"
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setMode("VOICE")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    mode === "VOICE"
                      ? "border-alert bg-alert/15 text-alert font-semibold"
                      : "border-line-strong text-static hover:text-signal"
                  }`}
                >
                  <Mic size={13} />
                  Voice
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs font-semibold uppercase tracking-wider text-static">
                Question Count
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 15].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setTotalQuestions(count)}
                    className={`rounded-lg border py-2 text-xs font-mono transition-colors ${
                      totalQuestions === count
                        ? "border-alert bg-alert/15 text-alert font-semibold"
                        : "border-line-strong text-static hover:text-signal"
                    }`}
                  >
                    {count} Qs
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error ? <p className="text-xs text-rose-400">{error}</p> : null}

        <button
          onClick={handleStart}
          disabled={starting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-alert py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 disabled:opacity-50 transition-opacity mt-2 shadow-lg"
        >
          {starting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-void border-t-transparent" />
              <span>Preparing Live Interview Session…</span>
            </>
          ) : (
            <>
              {interviewFormat === "REALTIME_VIDEO" ? (
                <>
                  <ShieldCheck size={15} />
                  <span>Enter Device Check & Live Interview</span>
                </>
              ) : (
                <>
                  <span>Begin Questionnaire Practice</span>
                  <ArrowRight size={14} />
                </>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
