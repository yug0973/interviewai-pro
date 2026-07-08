import type { SkillGap } from "@/lib/api"

interface SkillGapBarsProps {
  skillGaps: SkillGap[]
}

export function SkillGapBars({ skillGaps }: SkillGapBarsProps) {
  const max = skillGaps[0]?.count || 1

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="font-display text-base font-medium text-signal">Top skill gaps</h2>
      <p className="mt-1 text-xs text-static">
        Keywords your resumes are most often missing, across every analysis you've run.
      </p>

      {skillGaps.length === 0 ? (
        <p className="mt-6 text-sm text-static">
          Upload and analyze a resume to see your most common missing keywords here.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {skillGaps.map((gap) => (
            <div key={gap.keyword}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-signal">{gap.keyword}</span>
                <span className="font-mono text-xs text-static-dim">{gap.count}×</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-line">
                <div
                  className="h-1.5 rounded-full bg-alert transition-all"
                  style={{ width: `${Math.min(100, (gap.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
