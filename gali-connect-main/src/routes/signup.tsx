import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles, User, Mail, Phone, Lock, Loader2, Store } from "lucide-react";
import { useAuth, UserRole } from "@/context/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Vegamart" },
      {
        name: "description",
        content: "Create your Vegamart account and order from trusted local vendors near you.",
      },
    ],
  }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const { register, getGoogleAuthUrl } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setAccountRole] = useState<UserRole>("customer");
  const [agreed, setAgreed] = useState(true);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    if (!agreed) {
      toast.error("You must agree to the Terms & Privacy Policy");
      return;
    }

    setSubmitting(true);
    const res = await register({
      name,
      email,
      phone: phone ? `+91${phone}` : undefined,
      password,
      role,
    });
    setSubmitting(false);

    if (res.success) {
      toast.success(`Welcome to Vegamart, ${name}!`);
      if (role === "vendor") {
        navigate({ to: "/become-vendor" });
      } else {
        navigate({ to: "/" });
      }
    } else {
      toast.error(res.message || "Registration failed");
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
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold leading-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join India's live hyperlocal marketplace network.
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
          <span>Sign up with Google</span>
        </button>

        <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or sign up with email{" "}
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Account Type Selector */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAccountRole("customer")}
            className={`flex items-center justify-center gap-2 rounded-2xl border p-3 text-xs font-semibold transition-all ${
              role === "customer"
                ? "border-primary bg-emerald-50 text-primary shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-card"
            }`}
          >
            <User className="h-4 w-4" /> I'm a Customer
          </button>
          <button
            type="button"
            onClick={() => setAccountRole("vendor")}
            className={`flex items-center justify-center gap-2 rounded-2xl border p-3 text-xs font-semibold transition-all ${
              role === "vendor"
                ? "border-primary bg-emerald-50 text-primary shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-card"
            }`}
          >
            <Store className="h-4 w-4" /> I'm a Vendor
          </button>
        </div>

        <form className="mt-5 space-y-3.5" onSubmit={handleSubmit}>
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-foreground">Full name</div>
            <div className="flex items-center rounded-2xl bg-muted border h-11 px-3">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Riya Sharma"
                className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-foreground">Email address</div>
            <div className="flex items-center rounded-2xl bg-muted border h-11 px-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="riya@example.com"
                className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-foreground">
              Mobile number (optional)
            </div>
            <div className="flex items-center rounded-2xl bg-muted border h-11 px-3">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-bold tabular-nums ml-1.5 pr-2 border-r text-muted-foreground">
                +91
              </span>
              <input
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
                className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-foreground">Password (min 8 chars)</div>
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

          <label className="flex items-start gap-2.5 pt-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary"
            />
            <span>
              I agree to Vegamart's{" "}
              <Link
                to="/terms"
                className="font-semibold text-foreground underline underline-offset-4"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                className="font-semibold text-foreground underline underline-offset-4"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm h-11 hover:bg-primary/90 transition-colors disabled:opacity-50 mt-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Create Account <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
