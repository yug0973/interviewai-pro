import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PricingCard } from "@/components/billing/PricingCard";
import { loadRazorpayCheckout } from "@/lib/loadRazorpayCheckout";
import { billingApi, type PlanStatus, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

export default function Billing() {
  const { user, refreshUserAndPlan } = useAuth();
  const toast = useToast();

  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  function refresh() {
    return billingApi
      .status()
      .then((p) => {
        setPlan(p);
        refreshUserAndPlan();
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your plan."));
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleUpgrade() {
    setError("");
    setCheckingOut(true);
    try {
      const order = await billingApi.createOrder();
      await loadRazorpayCheckout();

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout failed to load. Please check your connection.");
      }

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "InterviewAI.Pro",
        description: "Pro Plan — 30 Days Unlimited Access",
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#F97316" },
        handler: async (response) => {
          try {
            await billingApi.verify(response);
            await refresh();
            toast.success("Upgrade complete!", "Welcome to InterviewAI Pro.");
          } catch (err) {
            const msg = err instanceof ApiError ? err.message : "Payment succeeded but verification failed.";
            setError(msg);
            toast.error("Verification failed", msg);
          }
        },
      });
      razorpay.open();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't start checkout. Try again.";
      setError(msg);
      toast.error("Checkout failed", msg);
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <DashboardShell>
      <div className="pb-6 border-b border-line">
        <h1 className="font-display text-2xl font-semibold text-signal">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-static">
          {loading
            ? "Loading subscription status…"
            : plan?.isPro
              ? `You have an active Pro Plan until ${new Date(plan.proExpiresAt!).toLocaleDateString()}.`
              : "You are currently on the Free Tier."}
        </p>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 text-xs text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 max-w-4xl mx-auto items-stretch">
        <PricingCard
          planName="Free"
          description="Everything you need to try the AI interviewer."
          priceLabel="₹0"
          priceSuffix="forever"
          features={[
            "3 resume uploads / month",
            "3 mock interview sessions / month",
            "Full ATS keyword and bullet analysis",
            "Adaptive voice & text interviews",
            "Basic performance analytics",
          ]}
          buttonText={plan && !plan.isPro ? "Current Plan" : "Included"}
          disabled
        />

        <PricingCard
          planName="Pro"
          description="Designed for serious technical candidates."
          priceLabel="₹499"
          priceSuffix="30 days unlimited access"
          isPopular
          features={[
            "Unlimited resume uploads & ATS reports",
            "Unlimited adaptive mock interviews",
            "Unlimited Job Description matches",
            "Detailed competency category scores",
            "Priority AI queue processing",
            "Continuous model evaluation updates",
          ]}
          buttonText={plan?.isPro ? "Active Plan" : "Upgrade to Pro"}
          disabled={Boolean(plan?.isPro)}
          loading={checkingOut}
          onClick={handleUpgrade}
        />
      </div>

      <div className="mt-12 rounded-2xl border border-line bg-surface p-6 text-center max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-left">
          <div className="grid size-10 place-content-center rounded-xl bg-alert/15 text-alert">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-signal">Secure Checkout via Razorpay</p>
            <p className="text-xs text-static">Encrypted payment gateway supporting UPI, Cards, and NetBanking.</p>
          </div>
        </div>

        <span className="font-mono text-xs text-static-dim">
          No auto-renew lock-in · One-time payment
        </span>
      </div>
    </DashboardShell>
  );
}
