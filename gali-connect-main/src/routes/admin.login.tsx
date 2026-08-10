import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { PasswordInput } from "@/components/ui/password-input";
import { Logo } from "@/components/system/logo";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Portal Sign In — Vegamart" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter admin credentials");
      return;
    }

    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);

    if (res.success) {
      toast.success("Admin authentication successful!");
      navigate({ to: "/admin" });
    } else {
      toast.error(res.message || "Failed to sign in as admin");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-card border rounded-3xl p-6 sm:p-8 shadow-soft">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 font-display text-lg font-bold">
            <Logo className="h-9 w-9" />
            Vegamart
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
            Admin Portal
          </span>
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold leading-tight">Admin Sign In</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restricted portal for system operations & approvals.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleAdminLogin}>
          <label className="block">
            <div className="mb-1.5 text-xs font-semibold text-foreground">Admin Email</div>
            <div className="flex items-center rounded-2xl bg-muted border h-11 px-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vegamart.in"
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
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                wrapperClassName="min-w-0 flex-1"
                className="bg-transparent px-2.5 pr-9 text-sm placeholder:text-muted-foreground"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 text-white font-semibold text-sm h-11 hover:bg-amber-700 transition-colors disabled:opacity-50 mt-2 shadow-xs"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign In to Admin Panel <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>
            Customer or Vendor?{" "}
            <Link to="/login" className="font-semibold text-foreground hover:underline">
              Go to Standard Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
