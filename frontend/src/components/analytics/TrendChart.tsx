import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface TrendPoint {
  label: string
  value: number
}

interface TrendChartProps {
  title: string
  data: TrendPoint[]
  color?: "alert" | "confirm"
  unit?: string
  emptyMessage?: string
}

const COLOR_HEX: Record<"alert" | "confirm", string> = {
  alert: "#ff8a3d",
  confirm: "#2fd69b",
}

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line-strong bg-surface-raised px-3 py-2 shadow-lg">
      <p className="font-mono text-xs text-signal">
        {payload[0].value}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  )
}

export function TrendChart({ title, data, color = "alert", unit, emptyMessage }: TrendChartProps) {
  const hex = COLOR_HEX[color]
  const gradientId = `trend-${title.replace(/\s+/g, "-").toLowerCase()}`

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="font-display text-base font-medium text-signal">{title}</h2>

      {data.length === 0 ? (
        <p className="mt-6 text-sm text-static">
          {emptyMessage ?? "Not enough data yet to chart a trend."}
        </p>
      ) : (
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={hex} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={hex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1c1e22" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#55585d"
                fontSize={11}
                fontFamily="IBM Plex Mono, monospace"
                tickLine={false}
                axisLine={{ stroke: "#1c1e22" }}
              />
              <YAxis
                stroke="#55585d"
                fontSize={11}
                fontFamily="IBM Plex Mono, monospace"
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: "#2a2d33", strokeDasharray: "3 3" }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={hex}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={{ r: 3, fill: hex, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
