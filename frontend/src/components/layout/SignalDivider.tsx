interface SignalDividerProps {
  label?: string
}

/**
 * Carries the shader's "live signal" motif through the rest of the page as
 * a cheap CSS animation rather than mounting additional live WebGL canvases
 * per section - four ShaderAnimation instances on one page would mean four
 * concurrent GL contexts, which is real cost for a purely decorative divider.
 */
export function SignalDivider({ label }: SignalDividerProps) {
  return (
    <div className="relative h-14 overflow-hidden border-y border-line bg-surface">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0px, transparent 22px, var(--color-line-strong) 22px, var(--color-line-strong) 23px)",
        }}
      />
      <div className="signal-sweep absolute inset-y-0 w-1/3 opacity-60" />
      {label ? (
        <div className="relative flex h-full items-center justify-center">
          <span className="font-mono text-[11px] tracking-[0.2em] text-static uppercase">
            {label}
          </span>
        </div>
      ) : null}
    </div>
  )
}
