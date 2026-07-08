import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  MessagesSquare,
  TrendingUp,
  Award,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Circle,
  Briefcase,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/ui/stat-card";
import {
  analyticsApi,
  interviewSessionApi,
  resumeApi,
  type AnalyticsOverview,
  type InterviewSession,
  type Resume,
  type SkillGap,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Dashboard() {
  const { user } = useAuth();

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
  const [dismissOnboarding, setDismissOnboarding] = useState(() =>
    localStorage.getItem("iap_dismiss_onboarding") === "true"
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [overviewRes, sessionsRes, resumesRes, skillGapsRes] = await Promise.all([
          analyticsApi.overview(),
          interviewSessionApi.list(),
          resumeApi.list(),
          analyticsApi.skillGaps(),
        ]);
        setOverview(overviewRes);
        setSessions(sessionsRes.sessions.slice(0, 5));
        setResumes(resumesRes.resumes);
        setSkillGaps(skillGapsRes.skillGaps.slice(0, 6));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load your dashboard.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const atsScore = overview?.resumes.averageAtsScore;
  const interviewScore = overview?.interviews.averageScore;
  let readinessScore: number | null = null;
  if (atsScore != null && interviewScore != null) {
    readinessScore = Math.round(atsScore * 0.4 + interviewScore * 0.6);
  } else if (atsScore != null) {
    readinessScore = Math.round(atsScore * 0.7);
  } else if (interviewScore != null) {
    readinessScore = interviewScore;
  }

  let nextAction = {
    title: "Upload your primary resume",
    desc: "Index your technical skills and get an instant ATS score.",
    cta: "Upload Resume",
    link: "/resumes",
  };

  if (resumes.length > 0 && sessions.length === 0) {
    const primaryRole = resumes[0].analysis?.detectedRole || "Software Engineer";
    nextAction = {
      title: `Take your first mock interview for ${primaryRole}`,
      desc: "Simulate a live technical round with adaptive follow-ups.",
      cta: "Start Interview",
      link: `/interviews?resumeId=${resumes[0].id}`,
    };
  } else if (sessions.length > 0 && interviewScore != null && interviewScore < 70) {
    nextAction = {
      title: "Practice your weakest technical topics",
      desc: "Run a 5-question focused drill on System Design and Edge Cases.",
      cta: "Run Weak Area Drill",
      link: `/interviews?focus=system_design`,
    };
  } else if (resumes.length > 0 && sessions.length > 0) {
    nextAction = {
      title: "Match your resume against a live Job Description",
      desc: "Identify missing keywords and generate targeted interview questions for your target company.",
      cta: "Run Job Match",
      link: `/job-match?resumeId=${resumes[0].id}`,
    };
  }

  const onboardingSteps = [
    { label: "Create Account", done: true },
    { label: "Upload & Parse Resume", done: resumes.length > 0 },
    { label: "Review ATS Optimizations", done: resumes.some((r) => r.status === "COMPLETED") },
    { label: "Complete First Mock Interview", done: sessions.some((s) => s.status === "COMPLETED") },
    { label: "Match a Target Job Description", done: false },
  ];
  const completedStepsCount = onboardingSteps.filter((s) => s.done).length;
  const showOnboarding = !dismissOnboarding && completedStepsCount < 5;

  function handleDismissOnboarding() {
    setDismissOnboarding(true);
    localStorage.setItem("iap_dismiss_onboarding", "true");
  }

  return (
    <DashboardShell>
      {/* Header & Plan Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-alert font-semibold">
            &gt; CANDIDATE_DASHBOARD
          </span>
          <h1 className="mt-1 font-display text-2xl font-semibold text-signal">
            Welcome back, {user ? user.name.split(" ")[0] : "Engineer"}
          </h1>
          <p className="mt-0.5 text-xs text-static font-mono">
            Here's where your technical interview readiness stands today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/job-match"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3.5 py-2 font-mono text-xs uppercase tracking-wider text-signal hover:bg-surface-raised transition-colors"
          >
            <Briefcase size={14} className="text-alert" /> Job Match
          </Link>
          <Link
            to="/interviews"
            className="inline-flex items-center gap-1.5 rounded-xl bg-alert px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 transition-opacity"
          >
            <Sparkles size={14} /> Quick Practice
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-alert border-t-transparent" />
        </div>
      ) : error ? (
        <div className="mt-8 rounded-xl border border-rose-500/20 bg-rose-950/20 p-6 text-center text-sm text-rose-300">
          {error}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Onboarding Wizard Checklist */}
          {showOnboarding && (
            <div className="rounded-2xl border border-alert/30 bg-alert/5 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-alert">
                    Getting Started Checklist ({completedStepsCount}/5 Completed)
                  </span>
                </div>
                <button
                  onClick={handleDismissOnboarding}
                  className="text-static hover:text-signal p-1 rounded-md transition-colors"
                  aria-label="Dismiss checklist"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                <div
                  className="h-full rounded-full bg-alert transition-all duration-300"
                  style={{ width: `${(completedStepsCount / 5) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5 pt-1">
                {onboardingSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium ${
                      step.done
                        ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                        : "border-line-strong bg-void/60 text-static"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Circle size={15} className="text-static-dim shrink-0" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hero Row: Dynamic Readiness Gauge & Personalized Next Action */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Readiness Gauge */}
            <div className="lg:col-span-4 rounded-2xl border border-line bg-surface p-6 sm:p-8 flex flex-col justify-between items-center text-center">
              <span className="font-mono text-[11px] uppercase tracking-wider text-alert font-semibold">
                Overall Readiness
              </span>
              <div className="my-4 font-display text-6xl font-bold text-signal">
                {readinessScore != null ? readinessScore : "—"}
                <span className="text-2xl font-normal text-static">/100</span>
              </div>
              <p className="text-xs text-static font-mono">
                {readinessScore != null && readinessScore >= 75
                  ? "Target Company Ready"
                  : readinessScore != null
                    ? "Building Foundation"
                    : "No Data Yet"}
              </p>
            </div>

            {/* Recommended Next Action */}
            <div className="lg:col-span-8 rounded-2xl border border-line bg-surface p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-alert" />
                  <span className="font-mono text-xs uppercase tracking-wider text-alert font-semibold">
                    Recommended Next Action
                  </span>
                </div>
                <h2 className="mt-2 font-display text-xl font-semibold text-signal">
                  {nextAction.title}
                </h2>
                <p className="mt-1 text-sm text-static leading-relaxed">
                  {nextAction.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-line">
                <Link
                  to={nextAction.link}
                  className="inline-flex items-center gap-2 rounded-xl bg-alert px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 transition-opacity"
                >
                  <span>{nextAction.cta}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={FileText}
              label="Resumes Analyzed"
              value={String(overview?.resumes.analyzed ?? 0)}
              hint={`${overview?.resumes.total ?? 0} uploaded`}
            />
            <StatCard
              icon={TrendingUp}
              label="Avg ATS Score"
              value={overview?.resumes.averageAtsScore != null ? `${overview.resumes.averageAtsScore}` : "—"}
              hint="Keywords & Bullet Impact"
            />
            <StatCard
              icon={MessagesSquare}
              label="Mock Interviews"
              value={String(overview?.interviews.completed ?? 0)}
              hint={`${overview?.interviews.inProgress ?? 0} active`}
            />
            <StatCard
              icon={Award}
              label="Avg Interview Score"
              value={overview?.interviews.averageScore != null ? `${overview.interviews.averageScore}` : "—"}
              hint="Architecture & Depth"
            />
          </div>

          {/* Bottom Grid: Recent Sessions & Recurring Skill Gaps */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold text-signal">
                    Recent Practice Sessions
                  </h2>
                  <p className="text-xs text-static">Past mock interviews with turn evaluations.</p>
                </div>
                <Link
                  to="/interviews"
                  className="font-mono text-xs uppercase tracking-wider text-alert hover:underline font-semibold"
                >
                  View all »
                </Link>
              </div>

              {sessions.length === 0 ? (
                <div className="rounded-xl border border-line bg-void p-8 text-center">
                  <p className="text-xs text-static">
                    No mock interviews taken yet. Start your first session to simulate real technical rounds.
                  </p>
                  <Link
                    to="/interviews"
                    className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs text-alert uppercase tracking-wider font-semibold"
                  >
                    Start an interview →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <Link
                      key={session.id}
                      to={`/interviews/${session.id}`}
                      className="flex items-center justify-between rounded-xl border border-line-strong bg-void p-3.5 hover:border-static-dim transition-all group"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-signal group-hover:text-alert transition-colors">
                          {session.targetRole}
                        </p>
                        <p className="text-xs text-static-dim font-mono">
                          {session.difficulty} · {session.mode} · {new Date(session.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {session.overallScore != null ? (
                          <span className="font-display text-base font-bold text-signal">
                            {session.overallScore}
                            <span className="text-xs font-normal text-static">/100</span>
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold border ${
                            session.status === "COMPLETED"
                              ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-400"
                              : "border-amber-500/30 bg-amber-950/30 text-amber-400"
                          }`}
                        >
                          {session.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recurring Missing Keywords Card */}
            <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-signal">
                  Top Missing Keywords
                </h2>
                <p className="text-xs text-static">Frequently missing from your analyzed resumes.</p>
              </div>

              {skillGaps.length === 0 ? (
                <div className="rounded-xl border border-line bg-void p-6 text-center text-xs text-static">
                  Upload and analyze a resume to discover missing keywords.
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {skillGaps.map((gap) => (
                    <div key={gap.keyword} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-signal">{gap.keyword}</span>
                        <span className="font-mono text-static-dim">{gap.count} resumes</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                        <div
                          className="h-full rounded-full bg-alert"
                          style={{
                            width: `${Math.min(100, (gap.count / (skillGaps[0]?.count || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
