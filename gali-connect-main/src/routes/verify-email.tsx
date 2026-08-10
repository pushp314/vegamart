import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Verify Email — Vegamart" }] }),
  component: VerifyEmail,
});

let isProcessing = false;

function VerifyEmail() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/verify-email" }) as { token?: string };
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (isProcessing) return;
    isProcessing = true;

    const handleVerify = async () => {
      if (!search?.token) {
        setStatus("error");
        setErrorMsg("No verification token provided. Please use the link from your email.");
        return;
      }

      try {
        const res = await api.post<{ email: string }>("/auth/verify-email", {
          token: search.token,
        });
        if (res.success && res.data) {
          setStatus("success");
          setEmail(res.data.email);
          toast.success("Email verified successfully!");
        } else {
          setStatus("error");
          setErrorMsg(
            res.error?.message || "Failed to verify email. The link may be invalid or expired.",
          );
          toast.error(res.error?.message || "Email verification failed");
          isProcessing = false;
        }
      } catch (err) {
        setStatus("error");
        setErrorMsg("An unexpected error occurred while verifying your email.");
        isProcessing = false;
      }
    };

    handleVerify();
  }, [search.token]);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const res = await api.post("/auth/resend-verification", { email });
      if (res.success) {
        toast.success("Verification email sent again. Check your inbox.");
      } else {
        toast.error(res.error?.message || "Failed to resend verification email");
      }
    } catch {
      toast.error("Failed to resend verification email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-card border rounded-3xl p-8 text-center shadow-soft space-y-4">
        {status === "loading" && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h2 className="font-display text-lg font-bold">Verifying your email</h2>
            <p className="text-xs text-muted-foreground">Please wait a moment...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="font-display text-lg font-bold">Email Verified!</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your email address has been verified successfully. You can now sign in to your
              account.
            </p>
            <button
              onClick={() => navigate({ to: "/login" })}
              className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xs h-11 shadow-xs hover:bg-primary/90"
            >
              Go to Sign In
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-rose-600">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="font-display text-lg font-bold text-destructive">Verification Failed</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">{errorMsg}</p>
            {email && (
              <button
                onClick={handleResend}
                disabled={resending}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-card py-2.5 px-4 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors shadow-xs disabled:opacity-50"
              >
                {resending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Resend Verification Email
              </button>
            )}
            <Link
              to="/login"
              className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xs h-11 shadow-xs hover:bg-primary/90"
            >
              Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
