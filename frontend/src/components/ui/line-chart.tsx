interface LineChartPoint {
  label: string
  value: number
}

interface LineChartProps {
  points: LineChartPoint[]
  height?: number
}

const WIDTH = 600

export function LineChart({ points, height = 180 }: LineChartProps) {
  if (points.length === 0) return null

  const values = points.map((p) => p.value)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 100)
  const range = max - min || 1

  const stepX = points.length > 1 ? WIDTH / (points.length - 1) : 0
  const coords = points.map((p, i) => ({
    x: points.length > 1 ? i * stepX : WIDTH / 2,
    y: height - ((p.value - min) / range) * (height - 24) - 12,
    ...p,
  }))

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineChartFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-alert)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-alert)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#lineChartFade)" />
      <path d={pathD} fill="none" stroke="var(--color-alert)" strokeWidth="2" />
      {coords.map((c) => (
        <circle key={c.label + c.x} cx={c.x} cy={c.y} r="3" fill="var(--color-alert)" />
      ))}
    </svg>
  )
}
