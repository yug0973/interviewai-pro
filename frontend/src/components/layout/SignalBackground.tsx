import type { ReactNode } from "react"
import { ShaderAnimation } from "@/components/ui/shader-lines"
import { cn } from "@/lib/utils"

interface SignalBackgroundProps {
  children: ReactNode
  className?: string
}

/**
 * Full-bleed shader backdrop, reusable across any page that needs the
 * "live signal" hero treatment (landing, and future auth/dashboard heroes).
 * A dark radial scrim sits between the shader and content so headline text
 * stays legible over the shader's brightest moments without dulling the
 * animation itself at the edges.
 */
export function SignalBackground({ children, className }: SignalBackgroundProps) {
  return (
    <div className={cn("relative overflow-hidden bg-void", className)}>
      <div className="absolute inset-0">
        <ShaderAnimation />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 30% 40%, rgba(8,9,11,0.72) 0%, rgba(8,9,11,0.55) 45%, rgba(8,9,11,0.88) 100%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
