import { useEffect, useState } from "react"
import { FileText, TrendingUp, MessagesSquare, Award } from "lucide-react"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { SignalBackground } from "@/components/layout/SignalBackground"
import { SignalDivider } from "@/components/layout/SignalDivider"
import { StatCard } from "@/components/ui/stat-card"
import { TrendChart } from "@/components/analytics/TrendChart"
import { StatusDonut } from "@/components/analytics/StatusDonut"
import { SkillGapBars } from "@/components/analytics/SkillGapBars"
import { ResumeHistoryTable } from "@/components/analytics/ResumeHistoryTable"
import {
  analyticsApi,
  ApiError,
  type AnalyticsOverview,
  type ResumeHistoryEntry,
  type InterviewHistoryEntry,
  type SkillGap,
} from "@/lib/api"

export default function Analytics() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [resumeHistory, setResumeHistory] = useState<ResumeHistoryEntry[]>([])
  const [interviewHistory, setInterviewHistory] = useState<InterviewHistoryEntry[]>([])
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [overviewRes, resumeHistoryRes, interviewHistoryRes, skillGapsRes] = await Promise.all([
          analyticsApi.overview(),
          analyticsApi.resumeHistory(),
          analyticsApi.interviewHistory(),
          analyticsApi.skillGaps(),
        ])
        setOverview(overviewRes)
        setResumeHistory(resumeHistoryRes.history)
        setInterviewHistory(interviewHistoryRes.history)
        setSkillGaps(skillGapsRes.skillGaps)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load your analytics.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const atsTrend = [...resumeHistory]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((row) => ({
      label: new Date(row.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: row.atsScore,
    }))

  const interviewTrend = [...interviewHistory]
    .filter((row): row is InterviewHistoryEntry & { date: string; overallScore: number } =>
      row.date != null && row.overallScore != null
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((row) => ({
      label: new Date(row.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: row.overallScore,
    }))

  const statusData = overview
    ? [
        { label: "Completed", value: overview.interviews.completed, color: "#2fd69b" },
        { label: "In progress", value: overview.interviews.inProgress, color: "#ff8a3d" },
        { label: "Abandoned", value: overview.interviews.abandoned, color: "#55585d" },
      ]
    : []

  return (
    <DashboardShell>
      <SignalBackground className="-m-8 mb-0 px-8 pb-8 pt-8">
        <div>
          <h1 className="font-display text-2xl font-medium text-signal">Analytics</h1>
          <p className="mt-1 text-sm text-static">
            How your resumes and interview performance are trending over time.
          </p>
        </div>

        {loading ? (
          <p className="mt-10 text-sm text-static">Loading…</p>
        ) : error ? (
          <p className="mt-10 text-sm text-red-400">{error}</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={FileText}
              label="Resumes analyzed"
              value={String(overview?.resumes.analyzed ?? 0)}
              hint={`${overview?.resumes.total ?? 0} uploaded total`}
            />
            <StatCard
              icon={TrendingUp}
              label="Avg ATS score"
              value={overview?.resumes.averageAtsScore != null ? `${overview.resumes.averageAtsScore}` : "—"}
            />
            <StatCard
              icon={MessagesSquare}
              label="Interviews completed"
              value={String(overview?.interviews.completed ?? 0)}
              hint={`${overview?.interviews.inProgress ?? 0} in progress`}
            />
            <StatCard
              icon={Award}
              label="Avg interview score"
              value={overview?.interviews.averageScore != null ? `${overview.interviews.averageScore}` : "—"}
            />
          </div>
        )}
      </SignalBackground>

      {!loading && !error && (
        <>
          <div className="-mx-8">
            <SignalDivider label="&gt; TRENDS" />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TrendChart
                title="ATS score trend"
                data={atsTrend}
                color="alert"
                emptyMessage="Analyze more than one resume to see how your ATS score is trending."
              />
            </div>
            <div className="rounded-xl border border-line bg-surface p-6">
              <h2 className="font-display text-base font-medium text-signal">Interview status breakdown</h2>
              <div className="mt-4">
                <StatusDonut data={statusData} centerLabel="Total" />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TrendChart
                title="Interview score trend"
                data={interviewTrend}
                color="confirm"
                emptyMessage="Complete an interview to start tracking your score over time."
              />
            </div>
            <SkillGapBars skillGaps={skillGaps} />
          </div>

          <div className="mt-6">
            <ResumeHistoryTable history={resumeHistory} />
          </div>
        </>
      )}
    </DashboardShell>
  )
}
