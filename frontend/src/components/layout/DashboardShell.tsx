import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  MessagesSquare,
  BarChart3,
  CreditCard,
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
  { icon: FileText, label: "Resumes", to: "/resumes" },
  { icon: Briefcase, label: "Job Match", to: "/job-match" },
  { icon: MessagesSquare, label: "Interviews", to: "/interviews" },
  { icon: BarChart3, label: "Analytics", to: "/analytics" },
  { icon: CreditCard, label: "Billing", to: "/billing" },
];

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [open, setOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, plan, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-void text-signal antialiased">
      {/* Mobile Top Navigation Bar */}
      <div className="flex lg:hidden fixed top-0 left-0 right-0 z-40 h-16 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur-md">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="grid size-8 place-content-center rounded-lg bg-alert/15 font-display text-sm font-semibold text-alert">
            iP
          </div>
          <span className="font-display text-sm font-semibold tracking-tight text-signal">
            InterviewAI<span className="text-alert">.Pro</span>
          </span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg border border-line-strong p-2 text-static hover:text-signal"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 flex flex-col bg-void/98 px-6 pt-20 pb-8 lg:hidden">
          <div className="flex-1 space-y-1.5 overflow-y-auto py-4">
            {NAV_ITEMS.map(({ icon: Icon, label, to }) => {
              const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex h-12 items-center justify-between rounded-xl px-4 text-base font-medium transition-colors",
                    active
                      ? "border border-alert/30 bg-alert/10 text-alert"
                      : "text-static hover:bg-surface hover:text-signal"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </Link>
              );
            })}
          </div>

          <div className="border-t border-line pt-4 space-y-3">
            <div className="flex items-center justify-between px-2 text-xs">
              <span className="text-static">{user?.name}</span>
              <span className="font-mono uppercase text-[10px] tracking-wider rounded-full bg-line-strong px-2 py-0.5 text-signal">
                {plan?.isPro ? "PRO PLAN" : "FREE PLAN"}
              </span>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex w-full h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-sm font-medium text-static hover:text-rose-400"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar Navigation */}
      <nav
        className={cn(
          "hidden lg:flex sticky top-0 h-screen shrink-0 flex-col border-r border-line bg-surface transition-all duration-250 z-20",
          open ? "w-64" : "w-20"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-content-center rounded-xl bg-alert/15 font-display text-base font-bold text-alert ring-1 ring-alert/30">
              iP
            </div>
            {open ? (
              <span className="font-display text-base font-semibold tracking-tight text-signal">
                InterviewAI<span className="text-alert">.Pro</span>
              </span>
            ) : null}
          </Link>
        </div>

        {/* User Card / Plan Badge */}
        {open ? (
          <div className="mx-3 my-3 rounded-xl border border-line bg-void/60 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-signal">{user?.name || "Candidate"}</p>
                <p className="truncate text-[11px] text-static-dim">{user?.email}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold",
                  plan?.isPro
                    ? "bg-alert/15 text-alert border border-alert/30"
                    : "bg-line-strong text-static border border-line"
                )}
              >
                {plan?.isPro ? "PRO" : "FREE"}
              </span>
            </div>
            {!plan?.isPro ? (
              <Link
                to="/billing"
                className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-alert/10 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-alert hover:bg-alert/20 transition-colors"
              >
                <Sparkles size={12} />
                Upgrade to Pro
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* Nav Links */}
        <div className="flex-1 space-y-1.5 px-3 py-2">
          {NAV_ITEMS.map(({ icon: Icon, label, to }) => {
            const active = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                title={!open ? label : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-150",
                  active
                    ? "border border-alert/30 bg-alert/10 text-alert shadow-xs"
                    : "text-static hover:bg-surface-raised hover:text-signal"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-alert" : "text-static")} />
                {open ? <span className="truncate">{label}</span> : null}
              </Link>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-line p-3 space-y-1">
          <button
            onClick={handleLogout}
            title={!open ? "Log out" : undefined}
            className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-static hover:bg-surface-raised hover:text-rose-400 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {open ? <span>Log out</span> : null}
          </button>

          <button
            onClick={() => setOpen(!open)}
            className="flex h-9 w-full items-center justify-center rounded-lg text-static-dim hover:bg-surface-raised hover:text-signal transition-colors font-mono text-xs"
          >
            {open ? "« Collapse sidebar" : "»"}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto px-4 pt-20 pb-12 sm:px-8 sm:py-8 lg:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
