import { Check } from "lucide-react";

export interface PricingCardProps {
  planName: string;
  description: string;
  priceLabel: string;
  priceSuffix: string;
  features: string[];
  buttonText: string;
  isPopular?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export function PricingCard({
  planName,
  description,
  priceLabel,
  priceSuffix,
  features,
  buttonText,
  isPopular = false,
  disabled = false,
  loading = false,
  onClick,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-1 flex-col rounded-2xl border p-8 transition-all duration-250 ${
        isPopular
          ? "border-alert/40 bg-surface shadow-2xl ring-1 ring-alert/20"
          : "border-line bg-surface"
      }`}
    >
      {isPopular ? (
        <div className="absolute -top-3.5 right-6 rounded-full bg-alert px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-void">
          Most Popular
        </div>
      ) : null}

      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-signal">{planName}</h2>
        <p className="mt-1 text-xs text-static">{description}</p>
      </div>

      <div className="my-6 flex items-baseline gap-2">
        <span className="font-display text-4xl font-bold text-signal">{priceLabel}</span>
        <span className="text-xs text-static font-mono">{priceSuffix}</span>
      </div>

      <div className="mb-6 h-px w-full bg-line" />

      <ul className="mb-8 flex flex-1 flex-col gap-3 text-xs text-static">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check className="h-4 w-4 shrink-0 text-alert mt-0.5" strokeWidth={2.5} />
            <span className="text-signal leading-relaxed">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 font-mono text-xs font-semibold uppercase tracking-wider transition-opacity ${
          isPopular
            ? "bg-alert text-void hover:opacity-90 disabled:opacity-50"
            : "border border-line-strong bg-void text-signal hover:bg-surface-raised disabled:opacity-50"
        }`}
      >
        {loading ? (
          <>
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-void border-t-transparent" />
            <span>Opening Checkout…</span>
          </>
        ) : (
          <span>{buttonText}</span>
        )}
      </button>
    </div>
  );
}
