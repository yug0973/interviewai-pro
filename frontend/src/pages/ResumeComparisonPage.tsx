import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ChevronLeft, ArrowRight, Award } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { resumeApi, type Resume, type ResumeComparisonResult, ApiError } from "@/lib/api";

export default function ResumeComparisonPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resumeAId, setResumeAId] = useState(searchParams.get("a") || "");
  const [resumeBId, setResumeBId] = useState(searchParams.get("b") || "");
  const [comparison, setComparison] = useState<ResumeComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    resumeApi.list().then((res) => {
      const completed = res.resumes.filter((r) => r.status === "COMPLETED" && r.analysis);
      setResumes(completed);
      if (completed.length >= 2 && (!resumeAId || !resumeBId)) {
        setResumeAId(completed[0].id);
        setResumeBId(completed[1].id);
      }
    });
  }, [resumeAId, resumeBId]);

  useEffect(() => {
    if (!resumeAId || !resumeBId || resumeAId === resumeBId) {
      setComparison(null);
      return;
    }

    setLoading(true);
    setError("");
    resumeApi
      .compare(resumeAId, resumeBId)
      .then((res) => {
        setComparison(res);
        setSearchParams({ a: resumeAId, b: resumeBId });
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to compare resumes.")
      )
      .finally(() => setLoading(false));
  }, [resumeAId, resumeBId, setSearchParams]);

  const betterResume =
    comparison &&
    (comparison.a.analysis.atsScore >= comparison.b.analysis.atsScore
      ? comparison.a
      : comparison.b);

  return (
    <DashboardShell>
      <div className="flex items-center justify-between pb-6 border-b border-line">
        <div>
          <Link
            to="/resumes"
            className="inline-flex items-center gap-1.5 text-sm text-static hover:text-signal transition-colors font-medium"
          >
            <ChevronLeft size={16} /> Back to Resumes
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-signal">
            Side-by-Side Resume Comparison
          </h1>
          <p className="mt-1 text-sm text-static">
            Compare two versions of your resume to see which performs better for your target role.
          </p>
        </div>
      </div>

      {/* Selectors */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5">
          <label className="font-mono text-xs uppercase tracking-wider text-static font-medium">
            Version A (Baseline)
          </label>
          <select
            value={resumeAId}
            onChange={(e) => setResumeAId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-line-strong bg-void px-4 py-2.5 text-sm text-signal outline-none focus:border-alert"
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id} disabled={r.id === resumeBId}>
                {r.label} ({r.analysis?.atsScore ?? 0} pts - {r.analysis?.detectedRole})
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <label className="font-mono text-xs uppercase tracking-wider text-static font-medium">
            Version B (Comparison)
          </label>
          <select
            value={resumeBId}
            onChange={(e) => setResumeBId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-line-strong bg-void px-4 py-2.5 text-sm text-signal outline-none focus:border-alert"
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id} disabled={r.id === resumeAId}>
                {r.label} ({r.analysis?.atsScore ?? 0} pts - {r.analysis?.detectedRole})
              </option>
            ))}
          </select>
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
      ) : comparison ? (
        <div className="mt-8 space-y-8">
          {/* Comparison Verdict Banner */}
          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 sm:flex-row sm:p-8">
            <div className="flex items-center gap-4">
              <div className="grid size-12 place-content-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Award size={24} />
              </div>
              <div>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Winning Version: {betterResume?.resume.label}
                </span>
                <p className="mt-1 text-sm font-medium text-signal">
                  Outperforms by {Math.abs(comparison.atsScoreDelta)} ATS score points with stronger keyword coverage and quantified experience.
                </p>
              </div>
            </div>

            <Link
              to={`/resumes/${betterResume?.resume.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:bg-emerald-400 transition-colors shrink-0"
            >
              View Full Report <ArrowRight size={14} />
            </Link>
          </div>

          {/* Side by side stats */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Version A Card */}
            <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold text-signal">
                    {comparison.a.resume.label}
                  </h3>
                  <p className="text-xs text-static font-mono">
                    {comparison.a.analysis.detectedRole} · {comparison.a.analysis.experienceLevel}
                  </p>
                </div>
                <div className="font-display text-4xl font-bold text-signal">
                  {comparison.a.analysis.atsScore}
                  <span className="text-sm font-normal text-static">/100</span>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-xs">
                <div>
                  <span className="font-mono uppercase text-static font-medium">Top Skills:</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {comparison.a.analysis.technicalSkills.slice(0, 6).map((s) => (
                      <span key={s} className="rounded-md border border-line bg-void px-2.5 py-1 text-signal">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-mono uppercase text-rose-400 font-medium">Missing Keywords:</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {comparison.a.analysis.missingKeywords.map((k) => (
                      <span key={k} className="rounded-md border border-rose-500/20 bg-rose-950/20 px-2.5 py-1 text-rose-300">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Version B Card */}
            <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold text-signal">
                    {comparison.b.resume.label}
                  </h3>
                  <p className="text-xs text-static font-mono">
                    {comparison.b.analysis.detectedRole} · {comparison.b.analysis.experienceLevel}
                  </p>
                </div>
                <div className="font-display text-4xl font-bold text-signal">
                  {comparison.b.analysis.atsScore}
                  <span className="text-sm font-normal text-static">/100</span>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-xs">
                <div>
                  <span className="font-mono uppercase text-static font-medium">Top Skills:</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {comparison.b.analysis.technicalSkills.slice(0, 6).map((s) => (
                      <span key={s} className="rounded-md border border-line bg-void px-2.5 py-1 text-signal">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="font-mono uppercase text-rose-400 font-medium">Missing Keywords:</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {comparison.b.analysis.missingKeywords.map((k) => (
                      <span key={k} className="rounded-md border border-rose-500/20 bg-rose-950/20 px-2.5 py-1 text-rose-300">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-12 text-center">
          <p className="text-sm text-static">
            Upload at least two analyzed resumes to compare them side-by-side.
          </p>
          <Link
            to="/resumes"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-alert px-4 py-2 font-mono text-xs uppercase tracking-wider text-void font-semibold"
          >
            Upload Resume
          </Link>
        </div>
      )}
    </DashboardShell>
  );
}
