import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/app-header";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({ meta: [{ title: "Refund & Cancellation — Vegamart" }] }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="Refund & Cancellation Policy" subtitle="Hassle-free customer guarantee" />

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6 text-xs text-muted-foreground leading-relaxed">
        <section className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft text-foreground">
          <h1 className="font-display text-xl font-bold">Refund & Cancellation Policy</h1>
          <p className="text-xs text-muted-foreground">
            At Vegamart, we ensure you receive 100% fresh produce and authentic local food.
          </p>
        </section>

        <section className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft">
          <h2 className="font-display text-base font-bold text-foreground">
            1. Order Cancellations
          </h2>
          <p>
            Orders can be cancelled free of cost before the vendor marks them as 'Accepted' or
            'Preparing'.
          </p>
        </section>

        <section className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft">
          <h2 className="font-display text-base font-bold text-foreground">
            2. Instant Refund Timeline
          </h2>
          <p>
            Approved refunds for online payments via Razorpay (UPI, Credit/Debit Cards) are credited
            back to your original payment source within 2 hours.
          </p>
        </section>
      </main>
    </div>
  );
}
