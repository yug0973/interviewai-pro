import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}

export function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-alert/10 p-2">
          <Icon className="h-5 w-5 text-alert" strokeWidth={1.75} />
        </div>
      </div>
      <h3 className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-static">
        {label}
      </h3>
      <p className="mt-1 font-display text-2xl font-medium text-signal">{value}</p>
      {hint ? <p className="mt-1 text-xs text-static-dim">{hint}</p> : null}
    </div>
  )
}
