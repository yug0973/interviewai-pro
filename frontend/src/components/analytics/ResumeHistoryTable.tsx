import type { ResumeHistoryEntry } from "@/lib/api"

interface ResumeHistoryTableProps {
  history: ResumeHistoryEntry[]
}

function scoreColor(score: number) {
  if (score >= 80) return "text-confirm"
  if (score >= 60) return "text-alert"
  return "text-static"
}

export function ResumeHistoryTable({ history }: ResumeHistoryTableProps) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="font-display text-base font-medium text-signal">Resume ATS history</h2>

      {history.length === 0 ? (
        <p className="mt-6 text-sm text-static">
          No analyzed resumes yet — upload one from the Resumes tab to see your ATS score history here.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="pb-3 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-static">
                  Resume
                </th>
                <th className="pb-3 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-static">
                  Role
                </th>
                <th className="pb-3 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-static">
                  Experience
                </th>
                <th className="pb-3 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-static">
                  ATS score
                </th>
                <th className="pb-3 pr-4 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-static">
                  Missing keywords
                </th>
                <th className="pb-3 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-static">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.resumeId + row.date} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-signal">{row.label}</span>
                      {row.isPrimary ? (
                        <span className="shrink-0 rounded-full border border-line-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-static">
                          Primary
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-static">{row.detectedRole}</td>
                  <td className="py-3 pr-4 text-static">{row.experienceLevel}</td>
                  <td className={`py-3 pr-4 font-mono ${scoreColor(row.atsScore)}`}>{row.atsScore}</td>
                  <td className="py-3 pr-4 text-static">{row.missingKeywordCount}</td>
                  <td className="py-3 text-static-dim">{new Date(row.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
