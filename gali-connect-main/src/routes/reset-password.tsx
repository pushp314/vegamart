import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Lock, Sparkles, Loader2, CheckCircle2, Mail } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset Password — Vegamart" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/reset-password" }) as { email?: string };
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState(search?.email || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter your registered email address");
      return;
    }
    if (!otp || otp.length < 6) {
      toast.error("Please enter the 6-digit OTP code");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    const res = await resetPassword(email, otp, newPassword);
    setSubmitting(false);

    if (res.success) {
      setSuccess(true);
      toast.success("Password reset successfully!");
    } else {
      toast.error(res.message || "Failed to reset password. Please check your OTP code.");
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
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          Vegamart
        </div>

        {success ? (
          <div className="mt-8 text-center space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Password Reset Complete!</h2>
            <p className="text-xs text-muted-foreground">
              Your password has been updated successfully. You can now log in with your new
              password.
            </p>
            <button
              onClick={() => navigate({ to: "/login" })}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm h-11"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold leading-tight">Set new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the 6-digit verification code and choose a new password.
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

              <label className="block">
                <div className="mb-1.5 text-xs font-semibold text-foreground">6-Digit OTP Code</div>
                <div className="flex items-center rounded-2xl bg-muted border h-11 px-3">
                  <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none font-bold placeholder:font-normal placeholder:text-muted-foreground"
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-semibold text-foreground">New Password</div>
                <div className="flex items-center rounded-2xl bg-muted border h-11 px-3">
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-semibold text-foreground">
                  Confirm New Password
                </div>
                <div className="flex items-center rounded-2xl bg-muted border h-11 px-3">
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm h-11 hover:bg-primary/90 transition-colors disabled:opacity-50 mt-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
