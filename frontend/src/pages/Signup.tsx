import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/layout/AuthShell";
import { Field } from "@/components/ui/field";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api";

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup({ name, email, password });
      toast.success("Account created!", "Welcome to InterviewAI Pro.");
      navigate("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't create your account. Try again.";
      setError(msg);
      toast.error("Registration failed", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="&gt; NEW_SESSION"
      title="Create an account"
      footer={
        <span>
          Already have one?{" "}
          <Link to="/login" className="text-alert hover:text-signal transition-colors font-medium">
            Log in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          id="name"
          label="Name"
          type="text"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          autoComplete="name"
        />
        <Field
          id="email"
          label="Email"
          type="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />

        {error ? (
          <div className="rounded-lg border border-rose-500/20 bg-rose-950/30 p-3 text-xs text-rose-300 leading-relaxed">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center rounded-lg bg-alert py-2.5 font-mono text-[13px] uppercase tracking-[0.12em] text-void font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
