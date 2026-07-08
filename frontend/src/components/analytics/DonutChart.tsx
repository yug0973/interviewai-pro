import { useMemo, useState, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

export interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  data: DonutSegment[]
  size?: number
  strokeWidth?: number
  centerContent?: ReactNode
  className?: string
}

/**
 * Pure SVG + framer-motion donut, adapted from a 21st.dev reference to use
 * this app's theme tokens instead of shadcn CSS vars (no recharts needed
 * for a simple proportional ring, and it keeps bundle weight down).
 */
export function DonutChart({ data, size = 168, strokeWidth = 20, centerContent, className }: DonutChartProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const total = useMemo(() => data.reduce((sum, segment) => sum + segment.value, 0), [data])
  const radius = size / 2 - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  let cumulative = 0

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      onMouseLeave={() => setHovered(null)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--color-line)"
          strokeWidth={strokeWidth}
        />
        <AnimatePresence>
          {data.map((segment) => {
            if (segment.value === 0) return null
            const percentage = total === 0 ? 0 : (segment.value / total) * 100
            const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
            const strokeDashoffset = -((cumulative / 100) * circumference)
            cumulative += percentage
            const isActive = hovered === segment.label

            return (
              <motion.circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
                initial={{ opacity: 0, strokeDashoffset: circumference }}
                animate={{ opacity: 1, strokeDashoffset }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                  filter: isActive ? `drop-shadow(0 0 6px ${segment.color})` : "none",
                  transformOrigin: "center",
                  transform: isActive ? "scale(1.03)" : "scale(1)",
                  transition: "filter 0.2s ease-out, transform 0.2s ease-out",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHovered(segment.label)}
              />
            )
          })}
        </AnimatePresence>
      </svg>

      {centerContent ? (
        <div
          className="pointer-events-none absolute flex flex-col items-center justify-center text-center"
          style={{ width: size - strokeWidth * 2.5, height: size - strokeWidth * 2.5 }}
        >
          {centerContent}
        </div>
      ) : null}
    </div>
  )
}
