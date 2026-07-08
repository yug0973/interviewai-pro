import type { InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function Field({ label, className, id, ...props }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-static"
      >
        {label}
      </label>
      <input
        id={id}
        className={cn(
          "w-full rounded-lg border border-line-strong bg-signal/5 px-4 py-2.5 text-sm text-signal placeholder-static-dim outline-none transition-colors focus:border-alert",
          className
        )}
        {...props}
      />
    </div>
  )
}
