import { useEffect, useState } from "react"

type Status = "PROCESSING" | "COMPLETED" | "FAILED"

interface StatusIconProps {
  status: Status
}

/**
 * The rotating-dash "processing" indicator is adapted from the 21st.dev
 * card-status-list "syncing" state - reused here because it reads as "live
 * work happening", which matches our real async BullMQ analysis job well.
 */
export function StatusIcon({ status }: StatusIconProps) {
  const [activeDash, setActiveDash] = useState(0)

  useEffect(() => {
    if (status !== "PROCESSING") return
    const interval = setInterval(() => setActiveDash((prev) => (prev + 1) % 8), 100)
    return () => clearInterval(interval)
  }, [status])

  if (status === "COMPLETED") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="8" fill="var(--color-confirm)" />
        <path
          d="M5 8l2.5 2.5 3.5-4"
          stroke="var(--color-void)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (status === "FAILED") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="8" fill="#f87171" />
        <path
          d="M5.5 5.5l5 5M10.5 5.5l-5 5"
          stroke="var(--color-void)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = index * 45 - 90
        const radian = (angle * Math.PI) / 180
        const radius = 6
        const dashLength = 1.8
        const startX = 8 + (radius - dashLength / 2) * Math.cos(radian)
        const startY = 8 + (radius - dashLength / 2) * Math.sin(radian)
        const endX = 8 + (radius + dashLength / 2) * Math.cos(radian)
        const endY = 8 + (radius + dashLength / 2) * Math.sin(radian)
        return (
          <line
            key={index}
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={index === activeDash ? "var(--color-alert)" : "var(--color-line-strong)"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}
