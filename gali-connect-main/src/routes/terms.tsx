import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/app-header";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms & Conditions — Vegamart" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="Terms & Conditions" subtitle="Marketplace User Agreement" />

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6 text-xs text-muted-foreground leading-relaxed">
        <section className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft text-foreground">
          <h1 className="font-display text-xl font-bold">Terms of Service</h1>
          <p className="text-xs text-muted-foreground">
            By accessing or using the Vegamart marketplace platform, you agree to be bound by these
            Terms and Conditions.
          </p>
        </section>

        <section className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft">
          <h2 className="font-display text-base font-bold text-foreground">
            1. Marketplace Platform
          </h2>
          <p>
            Vegamart operates as a technology facilitator connecting independent neighbourhood
            vendors with customers. Product pricing, freshness, and quality are managed by
            respective local vendors.
          </p>
        </section>

        <section className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft">
          <h2 className="font-display text-base font-bold text-foreground">
            2. User Account Responsibilities
          </h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and
            for all transactions placed under your account.
          </p>
        </section>
      </main>
    </div>
  );
}
