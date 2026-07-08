import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GitCompare, Briefcase } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ResumeUploadCard } from "@/components/resume/ResumeUploadCard";
import { ResumeListCard } from "@/components/resume/ResumeListCard";
import { resumeApi, type Resume, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";

const POLL_INTERVAL_MS = 3000;

export default function Resumes() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const { resumes } = await resumeApi.list();
      setResumes(resumes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your resumes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const hasProcessing = resumes.some((r) => r.status === "PROCESSING");
    if (!hasProcessing) return;
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [resumes, load]);

  async function handleSetPrimary(id: string) {
    try {
      await resumeApi.setPrimary(id);
      toast.success("Primary resume updated");
      load();
    } catch {
      toast.error("Failed to set primary resume");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this resume?")) return;
    try {
      await resumeApi.remove(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
      toast.success("Resume deleted");
    } catch {
      toast.error("Failed to delete resume");
    }
  }

  const completedResumes = resumes.filter((r) => r.status === "COMPLETED" && r.analysis);

  return (
    <DashboardShell>
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="font-display text-2xl font-semibold text-signal">Resumes & ATS Intelligence</h1>
          <p className="mt-1 text-sm text-static">
            Upload and analyze your resumes for ATS keyword matches, weak bullet rewrites, and role alignment.
          </p>
        </div>

        {completedResumes.length >= 2 ? (
          <div className="flex items-center gap-2.5">
            <Link
              to="/resumes/compare"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-4 py-2 font-mono text-xs uppercase tracking-wider text-signal hover:bg-surface-raised transition-colors"
            >
              <GitCompare size={14} className="text-alert" /> Compare Resumes
            </Link>
            <Link
              to="/job-match"
              className="inline-flex items-center gap-1.5 rounded-lg bg-alert px-4 py-2 font-mono text-xs uppercase tracking-wider text-void font-semibold hover:opacity-90 transition-opacity"
            >
              <Briefcase size={14} /> Match Job Description
            </Link>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-alert border-t-transparent" />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 items-start">
          <ResumeUploadCard onUploaded={load} />
          <ResumeListCard resumes={resumes} onSetPrimary={handleSetPrimary} onDelete={handleDelete} />
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
    </DashboardShell>
  );
}
