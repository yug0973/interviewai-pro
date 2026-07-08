import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface ScoreLineChartPoint {
  label: string
  value: number
}

interface ScoreLineChartProps {
  points: ScoreLineChartPoint[]
  height?: number
}

function ScoreTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line-strong bg-surface px-3 py-2 shadow-xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-static-dim">{label}</p>
      <p className="mt-0.5 font-display text-sm font-medium text-signal">{payload[0].value}</p>
    </div>
  )
}

/**
 * Replaces an earlier hand-rolled SVG chart - recharts gives real
 * interactive tooltips and proper axis/responsive handling for not much
 * more code, adapted from a 21st.dev multi-series dashboard chart down to
 * what our single-series (score over time) data actually needs.
 */
export function ScoreLineChart({ points, height = 220 }: ScoreLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreAreaFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-alert)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-alert)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--color-line)" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--color-static-dim)" }}
          tickMargin={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "var(--color-static-dim)" }}
          domain={[0, 100]}
          width={30}
        />
        <Tooltip content={<ScoreTooltip />} cursor={{ stroke: "var(--color-line-strong)" }} />
        <Area type="monotone" dataKey="value" stroke="transparent" fill="url(#scoreAreaFade)" dot={false} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-alert)"
          strokeWidth={2}
          dot={{ fill: "var(--color-void)", strokeWidth: 2, r: 4, stroke: "var(--color-alert)" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
