import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

export interface DonutSegment {
  label: string
  value: number
  color: string
}

interface StatusDonutProps {
  data: DonutSegment[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
}

export function StatusDonut({ data, size = 200, strokeWidth = 22, centerLabel = "Total" }: StatusDonutProps) {
  const [hovered, setHovered] = useState<DonutSegment | null>(null)

  const total = useMemo(() => data.reduce((sum, s) => sum + s.value, 0), [data])
  const radius = size / 2 - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  if (total === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-sm text-static">No interview sessions yet.</p>
      </div>
    )
  }

  let cumulative = 0
  const active = hovered ?? { label: centerLabel, value: total, color: "" }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
        onMouseLeave={() => setHovered(null)}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="#1c1e22" strokeWidth={strokeWidth} />
          <AnimatePresence>
            {data.map((segment, i) => {
              if (segment.value === 0) return null
              const pct = (segment.value / total) * 100
              const dash = `${(pct / 100) * circumference} ${circumference}`
              const offset = (cumulative / 100) * circumference
              cumulative += pct
              const isActive = hovered?.label === segment.label

              return (
                <motion.circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  style={{
                    filter: isActive ? `drop-shadow(0px 0px 6px ${segment.color})` : "none",
                    transformOrigin: "center",
                    transform: isActive ? "scale(1.02)" : "scale(1)",
                    transition: "filter 0.2s ease-out, transform 0.2s ease-out",
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHovered(segment)}
                />
              )
            })}
          </AnimatePresence>
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-static">{active.label}</p>
              <p className="mt-1 font-display text-2xl font-medium text-signal">{active.value}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {data.map((segment) => (
          <div
            key={segment.label}
            className={cn(
              "flex items-center justify-between gap-6 rounded-md px-2 py-1.5 transition-colors",
              hovered?.label === segment.label && "bg-line"
            )}
            onMouseEnter={() => setHovered(segment)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-sm text-signal">{segment.label}</span>
            </div>
            <span className="font-mono text-xs text-static-dim">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
