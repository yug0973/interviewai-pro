import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Star,
  Trash2,
  Briefcase,
  Copy,
  Check,
  ChevronLeft,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { resumeApi, type Resume, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";

export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    resumeApi
      .get(id)
      .then((res) => setResume(res.resume))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load resume report.")
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSetPrimary() {
    if (!id) return;
    try {
      const res = await resumeApi.setPrimary(id);
      setResume(res.resume);
      toast.success("Primary resume updated");
    } catch {
      toast.error("Failed to set primary resume");
    }
  }

  async function handleDelete() {
    if (!id || !confirm("Are you sure you want to delete this resume?")) return;
    try {
      await resumeApi.remove(id);
      toast.success("Resume deleted");
      navigate("/resumes");
    } catch {
      toast.error("Failed to delete resume");
    }
  }

  function handleCopy(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-alert border-t-transparent" />
            <span className="font-mono text-xs uppercase tracking-widest text-static">
              Loading ATS Report…
            </span>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !resume) {
    return (
      <DashboardShell>
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-sm text-rose-400">{error || "Resume not found"}</p>
          <Link
            to="/resumes"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 font-mono text-xs uppercase tracking-wider text-signal hover:bg-surface-raised"
          >
            <ChevronLeft size={14} /> Back to resumes
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const analysis = resume.analysis;
  const score = analysis?.atsScore ?? 0;

  const scoreColor =
    score >= 80
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
      : score >= 60
        ? "text-amber-400 border-amber-500/30 bg-amber-950/20"
        : "text-rose-400 border-rose-500/30 bg-rose-950/20";

  return (
    <DashboardShell>
      {/* Back Button & Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-line">
        <Link
          to="/resumes"
          className="inline-flex items-center gap-2 text-sm text-static hover:text-signal transition-colors font-medium"
        >
          <ChevronLeft size={16} /> All Resumes
        </Link>
        <div className="flex items-center gap-2">
          {!resume.isPrimary ? (
            <button
              onClick={handleSetPrimary}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs font-medium text-static hover:text-alert hover:border-alert/40 transition-colors"
            >
              <Star size={14} /> Set as Primary
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-alert/30 bg-alert/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-alert">
              <Star size={13} className="fill-alert" /> Primary Resume
            </span>
          )}

          <Link
            to={`/job-match?resumeId=${resume.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-alert px-3.5 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 transition-opacity"
          >
            <Briefcase size={14} /> Match Job Description
          </Link>

          <button
            onClick={handleDelete}
            className="rounded-lg border border-line-strong bg-surface p-2 text-static hover:text-rose-400 hover:border-rose-500/30 transition-colors"
            title="Delete resume"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Hero Header: ATS Score & Overview */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ATS Score Card */}
        <div className={`rounded-2xl border p-8 flex flex-col items-center justify-center text-center ${scoreColor}`}>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold">
            ATS Match Score
          </span>
          <div className="mt-4 font-display text-6xl font-bold tracking-tight">
            {score}
            <span className="text-2xl font-normal opacity-60">/100</span>
          </div>
          <p className="mt-2 text-xs text-static font-mono uppercase tracking-wider">
            {score >= 80 ? "Excellent ATS Readiness" : score >= 60 ? "Good — Actionable Gaps" : "Needs Optimization"}
          </p>
        </div>

        {/* Overview & Metadata */}
        <div className="lg:col-span-2 rounded-2xl border border-line bg-surface p-8 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold text-signal">{resume.label}</h1>
              {analysis?.detectedRole ? (
                <span className="rounded-full border border-alert/30 bg-alert/10 px-3 py-0.5 font-mono text-xs font-medium text-alert">
                  {analysis.detectedRole}
                </span>
              ) : null}
              {analysis?.experienceLevel ? (
                <span className="rounded-full border border-line-strong bg-void px-2.5 py-0.5 font-mono text-xs uppercase text-static">
                  {analysis.experienceLevel} Level
                </span>
              ) : null}
            </div>

            <p className="mt-4 text-sm leading-relaxed text-static">
              {analysis?.summary || "Analysis is processing in the background."}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 pt-4 border-t border-line text-xs text-static-dim font-mono">
            <span>File: {resume.originalFilename}</span>
            <span>·</span>
            <span>Size: {(resume.fileSizeBytes / 1024).toFixed(0)} KB</span>
            <span>·</span>
            <span>Uploaded: {new Date(resume.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {analysis && (
        <>
          {/* FIX THESE FIRST - High Priority Action Items */}
          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-6 sm:p-8">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider font-semibold">
              <AlertTriangle size={16} /> Priority Optimization Actions
            </div>
            <h2 className="mt-2 font-display text-lg font-semibold text-signal">
              Fix these first to boost your score
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analysis.suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-line-strong bg-void/80 p-5 flex flex-col justify-between"
                >
                  <div>
                    <span className="font-mono text-[10px] font-semibold text-alert uppercase tracking-wider">
                      Action #{idx + 1}
                    </span>
                    <p className="mt-2 text-sm leading-relaxed text-signal">{suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bullet Point Rewrites (Before & After with 1-click copy) */}
          {analysis.rewriteSuggestions?.length ? (
            <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-alert font-semibold">
                    &gt; BULLET_OPTIMIZER
                  </span>
                  <h2 className="mt-1 font-display text-lg font-semibold text-signal">
                    High-Impact Bullet Point Rewrites
                  </h2>
                  <p className="mt-1 text-sm text-static">
                    Replace weak phrasing with quantified, action-oriented bullet points.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {analysis.rewriteSuggestions.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-4 rounded-xl border border-line-strong bg-void p-5 lg:grid-cols-2"
                  >
                    <div className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-4">
                      <span className="font-mono text-[10px] font-semibold text-rose-400 uppercase tracking-wider">
                        Original Bullet (Weak / Unquantified)
                      </span>
                      <p className="mt-2 text-sm text-static leading-relaxed line-through opacity-80">
                        {item.original}
                      </p>
                    </div>

                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                            ATS-Optimized Rewrite
                          </span>
                          <button
                            onClick={() => handleCopy(item.rewritten, idx)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs text-signal hover:border-emerald-400 transition-colors"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="mt-2 text-sm font-medium text-emerald-200 leading-relaxed">
                          {item.rewritten}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Skills & Missing Keywords Matrix */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Detected Skills */}
            <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
              <h3 className="font-display text-base font-semibold text-signal">
                Detected Technical & Soft Skills
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {analysis.technicalSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg border border-line-strong bg-void px-3 py-1.5 font-mono text-xs text-signal"
                  >
                    {skill}
                  </span>
                ))}
                {analysis.softSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg border border-line bg-void px-3 py-1.5 font-mono text-xs text-static"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Keywords */}
            <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-rose-400 font-mono text-xs uppercase tracking-wider font-semibold">
                <AlertTriangle size={14} /> Missing ATS Keywords
              </div>
              <p className="mt-1 text-xs text-static">
                Keywords recruiters search for that are missing from your resume:
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {analysis.missingKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-1.5 font-mono text-xs font-medium text-rose-300"
                  >
                    + {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Section Reviews */}
          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h3 className="font-display text-lg font-semibold text-signal">Section-by-Section Assessment</h3>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-line-strong bg-void p-5">
                <span className="font-mono text-[11px] font-semibold text-alert uppercase tracking-wider">
                  Experience Section
                </span>
                <p className="mt-2 text-xs leading-relaxed text-static">
                  {analysis.experienceReview}
                </p>
              </div>

              <div className="rounded-xl border border-line-strong bg-void p-5">
                <span className="font-mono text-[11px] font-semibold text-alert uppercase tracking-wider">
                  Projects Section
                </span>
                <p className="mt-2 text-xs leading-relaxed text-static">
                  {analysis.projectReview}
                </p>
              </div>

              <div className="rounded-xl border border-line-strong bg-void p-5">
                <span className="font-mono text-[11px] font-semibold text-alert uppercase tracking-wider">
                  Education Section
                </span>
                <p className="mt-2 text-xs leading-relaxed text-static">
                  {analysis.educationReview}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Practice Launcher */}
          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-alert/30 bg-alert/10 p-6 sm:flex-row sm:p-8">
            <div>
              <h3 className="font-display text-lg font-semibold text-signal">
                Ready to test your technical skills in a live mock interview?
              </h3>
              <p className="mt-1 text-sm text-static">
                Start an adaptive mock interview customized to your {analysis.detectedRole} background.
              </p>
            </div>
            <Link
              to={`/interviews?resumeId=${resume.id}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-alert px-6 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 transition-opacity"
            >
              Start Practice Session <ArrowRight size={16} />
            </Link>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
