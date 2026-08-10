import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bike, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/context/auth-context";

export const Route = createFileRoute("/delivery/login")({
  head: () => ({ meta: [{ title: "Delivery Partner Login — Vegamart" }] }),
  component: DeliveryLoginPage,
});

function DeliveryLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await login(email, password);
    setSubmitting(false);

    if (res.success) {
      navigate({ to: "/delivery" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader title="Delivery Fleet Login" back={true} />

      <main className="mx-auto max-w-md px-4 pt-8 sm:pt-12 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-100 text-emerald-800 shadow-soft">
            <Bike className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold">Delivery Partner Portal</h1>
          <p className="text-xs text-muted-foreground">
            Sign in to access delivery requests and transmit live GPS tracking coordinates.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border bg-card p-6 shadow-soft space-y-4"
        >
          <label className="block">
            <div className="mb-1 text-xs font-semibold text-foreground flex items-center gap-1">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Address
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="delivery@vegamart.in"
              required
              className="w-full rounded-2xl bg-muted border h-11 px-3.5 text-sm outline-none"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-foreground flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Password
            </div>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="rounded-2xl bg-muted border h-11 px-3.5 pr-10 text-sm outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-primary text-primary-foreground font-bold text-xs h-11 flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign In to Rider Fleet <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
