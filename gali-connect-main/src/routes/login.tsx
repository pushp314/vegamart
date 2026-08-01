import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Lock, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Vegamart" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { login, getGoogleAuthUrl, guestLogin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      const url = await getGoogleAuthUrl();
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Failed to generate Google OAuth URL");
      }
    } catch (err) {
      toast.error("Google sign in error");
    }
  };

  const handleGuestLogin = async () => {
    try {
      await guestLogin();
      toast.success("Welcome, Guest!");
      navigate({ to: "/" });
    } catch (err) {
      toast.error("Guest login error");
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in email and password");
      return;
    }

    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);

    if (res.success) {
      toast.success("Welcome back to Vegamart!");
      navigate({ to: "/" });
    } else {
      toast.error(res.message || "Failed to sign in");
    }
  };



  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-card border rounded-3xl p-6 sm:p-8 shadow-soft">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            Vegamart
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            Marketplace
          </span>
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold leading-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to discover vendors and manage orders.
        </p>

        {/* Google Sign-in */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border bg-card py-2.5 px-4 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors shadow-xs"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <button
          type="button"
          onClick={handleGuestLogin}
          className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl border bg-card py-2.5 px-4 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors shadow-xs"
        >
          <span>Continue as Guest</span>
        </button>

        <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleEmailLogin}>
          <label className="block">
            <div className="mb-1.5 text-xs font-semibold text-foreground">Email address</div>
            <div className="flex items-center rounded-2xl bg-muted border h-11 px-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>

          <label className="block">
            <div className="flex justify-between mb-1.5 text-xs font-semibold text-foreground">
              <span>Password</span>
              <Link to="/forgot-password" className="text-primary hover:underline">
                Forgot?
              </Link>
            </div>
            <div className="flex items-center rounded-2xl bg-muted border h-11 px-3">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm h-11 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign In <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          New to Vegamart?{" "}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </div>

        <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>Are you a partner or rider?</span>
          <div className="flex items-center gap-2 font-semibold flex-wrap justify-center">
            <Link to="/vendor/login" className="text-emerald-700 hover:underline">
              Vendor Portal
            </Link>
            <span>•</span>
            <Link to="/delivery/login" className="text-indigo-600 font-bold hover:underline">
              Delivery Portal 🛵
            </Link>
            <span>•</span>
            <Link to="/admin/login" className="text-amber-700 hover:underline">
              Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
