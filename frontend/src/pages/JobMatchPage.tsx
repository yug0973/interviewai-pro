import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Briefcase,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { resumeApi, jobMatchApi, type Resume, type JobMatchResult, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";

export default function JobMatchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState(searchParams.get("resumeId") || "");
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    resumeApi.list().then((res) => {
      const completed = res.resumes.filter((r) => r.status === "COMPLETED" && r.analysis);
      setResumes(completed);
      if (!selectedResumeId && completed.length > 0) {
        setSelectedResumeId(completed[0].id);
      }
    });
  }, [selectedResumeId]);

  async function handleAnalyze() {
    if (!jobDescription.trim()) {
      setError("Please paste the job description text.");
      return;
    }
    if (jobDescription.trim().length < 50) {
      setError("Job description should be at least 50 characters for an accurate match.");
      return;
    }
    if (!selectedResumeId) {
      setError("Please select a resume to match against.");
      return;
    }

    setLoading(true);
    setError("");
    setMatchResult(null);

    try {
      const res = await jobMatchApi.match({
        resumeId: selectedResumeId,
        jobDescriptionText: jobDescription,
        targetRole: targetRole || undefined,
      });
      setMatchResult(res.match);
      toast.success("Job match analysis complete!");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to analyze job match.";
      setError(msg);
      toast.error("Analysis failed", msg);
    } finally {
      setLoading(false);
    }
  }

  function handleStartInterview(roleTitle: string) {
    navigate(`/interviews?resumeId=${selectedResumeId}&role=${encodeURIComponent(roleTitle)}`);
  }

  return (
    <DashboardShell>
      <div className="pb-6 border-b border-line">
        <h1 className="font-display text-2xl font-semibold text-signal">
          Resume vs. Job Description Matching
        </h1>
        <p className="mt-1 text-sm text-static">
          Paste any job description to get an instant match score, missing skills, and likely interview questions.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Input Form Column */}
        <div className="lg:col-span-5 space-y-5 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-static">
              Select Analyzed Resume
            </label>
            {resumes.length > 0 ? (
              <select
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-void px-3.5 py-2.5 text-sm text-signal outline-none focus:border-alert"
              >
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} ({r.analysis?.atsScore} pts · {r.analysis?.detectedRole})
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-line bg-void p-3 text-xs text-static">
                No analyzed resumes found.{" "}
                <Link to="/resumes" className="text-alert underline">
                  Upload a resume first
                </Link>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-static">
              Target Job Title (Optional)
            </label>
            <input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              className="w-full rounded-lg border border-line-strong bg-void px-3.5 py-2.5 text-sm text-signal placeholder-static-dim outline-none focus:border-alert"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-static">
              Job Description Text
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={12}
              placeholder="Paste the full job posting, requirements, and responsibilities here…"
              className="w-full resize-y rounded-lg border border-line-strong bg-void px-4 py-3 text-xs leading-relaxed text-signal placeholder-static-dim outline-none focus:border-alert font-mono"
            />
          </div>

          {error ? <p className="text-xs text-rose-400">{error}</p> : null}

          <button
            onClick={handleAnalyze}
            disabled={loading || !selectedResumeId}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-alert py-3 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-void border-t-transparent" />
                <span>Comparing with AI Model…</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Run Job Match Analysis</span>
              </>
            )}
          </button>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-7">
          {matchResult ? (
            <div className="space-y-6">
              {/* Match Score Card */}
              <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-alert font-semibold">
                    &gt; MATCH_ASSESSMENT
                  </span>
                  <h2 className="mt-1 font-display text-xl font-semibold text-signal">
                    {matchResult.roleTitle}
                  </h2>
                  <p className="mt-1 text-xs text-static font-mono">
                    {matchResult.experienceLevelMatch}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-static">
                    {matchResult.summary}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-alert/30 bg-alert/10 p-6 shrink-0 text-center min-w-[130px]">
                  <span className="font-mono text-[10px] uppercase font-semibold text-alert">Match Score</span>
                  <div className="mt-1 font-display text-4xl font-bold text-signal">
                    {matchResult.matchScore}%
                  </div>
                </div>
              </div>

              {/* Skills Matrix (Matched vs Missing) */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider">
                    <CheckCircle2 size={15} /> Matching Skills
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {matchResult.matchingSkills.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 font-mono text-xs text-emerald-300"
                      >
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-6">
                  <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-semibold uppercase tracking-wider">
                    <AlertTriangle size={15} /> Missing Requirements
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {matchResult.missingSkills.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-rose-500/30 bg-rose-950/40 px-2.5 py-1 font-mono text-xs text-rose-300"
                      >
                        + {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actionable Resume Improvements */}
              {matchResult.resumeImprovements?.length ? (
                <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <h3 className="font-display text-base font-semibold text-signal">
                    Tailor Your Resume For This Role
                  </h3>
                  <div className="mt-4 space-y-3">
                    {matchResult.resumeImprovements.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-line-strong bg-void p-4 space-y-1.5 text-xs">
                        <p className="font-semibold text-alert">{item.what}</p>
                        <p className="text-static leading-relaxed"><strong className="text-signal">Why:</strong> {item.why}</p>
                        <p className="text-emerald-300 font-mono"><strong className="text-signal">How:</strong> {item.how}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Likely Interview Questions */}
              {matchResult.likelyInterviewQuestions?.length ? (
                <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-semibold text-signal">
                        Likely Interview Questions for this JD
                      </h3>
                      <p className="mt-0.5 text-xs text-static">
                        High-probability questions tailored to your background vs this role.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {matchResult.likelyInterviewQuestions.map((q, idx) => (
                      <div key={idx} className="rounded-xl border border-line-strong bg-void p-4 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase font-semibold text-alert">
                            {q.category}
                          </span>
                        </div>
                        <p className="font-medium text-signal text-sm">{q.question}</p>
                        <p className="text-static leading-relaxed text-[11px]">{q.why}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleStartInterview(matchResult.roleTitle)}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-alert py-3 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 transition-opacity"
                  >
                    <span>Launch Tailored Mock Interview For This Role</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/30 p-12 text-center">
              <div className="grid size-12 place-content-center rounded-2xl bg-surface text-static">
                <Briefcase size={24} />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-signal">
                Paste a Job Description on the left
              </h3>
              <p className="mt-1 max-w-sm text-xs text-static leading-relaxed">
                We'll run an AI semantic match against your resume to identify skill gaps, missing keywords, and create a practice interview plan.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
