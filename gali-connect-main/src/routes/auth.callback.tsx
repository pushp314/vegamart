import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Authenticating with Google — Vegamart" }] }),
  component: AuthCallback,
});

let isProcessingAuth = false;

function AuthCallback() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback" }) as { code?: string; error?: string };
  const { googleLogin } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isProcessingAuth) return;
    isProcessingAuth = true;

    const handleGoogleAuth = async () => {
      if (search?.error) {
        setStatus("error");
        setErrorMsg("Google authorization was denied or failed.");
        toast.error("Google authentication failed");
        return;
      }

      if (!search?.code) {
        setStatus("error");
        setErrorMsg("No authorization code received from Google.");
        return;
      }

      try {
        const res = await googleLogin(search.code);
        if (res.success) {
          setStatus("success");
          toast.success("Signed in with Google successfully!");
          setTimeout(() => {
            navigate({ to: "/" });
          }, 800);
        } else {
          setStatus("error");
          setErrorMsg(res.message || "Failed to authenticate with Google.");
          toast.error(res.message || "Google sign in failed");
          isProcessingAuth = false; // Reset on failure so they can try again if they navigate back
        }
      } catch (err) {
        setStatus("error");
        setErrorMsg("Unexpected authentication error occurred.");
        isProcessingAuth = false; // Reset on failure
      }
    };

    handleGoogleAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.code, search.error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-card border rounded-3xl p-8 text-center shadow-soft space-y-4">
        {status === "loading" && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h2 className="font-display text-lg font-bold">Authenticating with Google</h2>
            <p className="text-xs text-muted-foreground">
              Please wait while we verify your Google credentials...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="font-display text-lg font-bold">Success!</h2>
            <p className="text-xs text-muted-foreground">
              Welcome to Vegamart. Redirecting to home...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-rose-600">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="font-display text-lg font-bold text-destructive">
              Authentication Error
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => navigate({ to: "/login" })}
              className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xs h-11 shadow-xs hover:bg-primary/90"
            >
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
