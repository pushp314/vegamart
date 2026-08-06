import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Logo } from "@/components/system/logo";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot Password — Vegamart" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    const res = await forgotPassword(email);
    setSubmitting(false);

    if (res.success) {
      toast.success("Password reset code sent to your email!");
      navigate({ to: "/reset-password", search: { email } });
    } else {
      toast.error(res.message || "Failed to send reset code");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-card border rounded-3xl p-6 sm:p-8 shadow-soft">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sign in
        </Link>

        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <Logo className="h-9 w-9" />
          Vegamart
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold leading-tight">Forgot password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your registered email address and we'll send a 6-digit OTP code to reset your
          password.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm h-11 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Send Reset Code <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
