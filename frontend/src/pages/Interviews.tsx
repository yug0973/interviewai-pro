import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StartInterviewCard } from "@/components/interview/StartInterviewCard";
import { InterviewListCard } from "@/components/interview/InterviewListCard";
import { interviewSessionApi, resumeApi, type InterviewSession, type Resume, ApiError } from "@/lib/api";

export default function Interviews() {
  const [searchParams] = useSearchParams();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const initialResumeId = searchParams.get("resumeId") || "";
  const initialRole = searchParams.get("role") || "";

  useEffect(() => {
    async function load() {
      try {
        const [sessionsRes, resumesRes] = await Promise.all([
          interviewSessionApi.list(),
          resumeApi.list(),
        ]);
        setSessions(sessionsRes.sessions);
        setResumes(resumesRes.resumes);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load your interviews.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const completedResumes = resumes.filter((r) => r.status === "COMPLETED" && r.analysis);

  return (
    <DashboardShell>
      <div className="pb-6 border-b border-line">
        <h1 className="font-display text-2xl font-semibold text-signal">AI Mock Interview Simulator</h1>
        <p className="mt-1 text-sm text-static">
          Adaptive voice and text technical interviews that dynamically test your edge-case thinking and communication.
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-alert border-t-transparent" />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 items-start">
          <StartInterviewCard
            completedResumes={completedResumes}
            initialResumeId={initialResumeId}
            initialRole={initialRole}
          />
          <InterviewListCard sessions={sessions} />
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
    </DashboardShell>
  );
}
