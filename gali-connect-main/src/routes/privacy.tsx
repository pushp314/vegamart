import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/app-header";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — Vegamart" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="Privacy Policy" subtitle="Last updated: January 2026" />

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6 text-xs text-muted-foreground leading-relaxed">
        <section className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft text-foreground">
          <h1 className="font-display text-xl font-bold">Vegamart Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">
            Vegamart ("we", "our", "us") values your trust. This Privacy Policy outlines how your
            personal information is collected, used, and protected when you access our hyperlocal
            marketplace.
          </p>
        </section>

        <section className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft">
          <h2 className="font-display text-base font-bold text-foreground">
            1. Information We Collect
          </h2>
          <p>
            When you register or place an order, we collect information including your name, email
            address, phone number, delivery address, and precise geolocation data to enable nearby
            vendor discovery and delivery.
          </p>
        </section>

        <section className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft">
          <h2 className="font-display text-base font-bold text-foreground">2. Payment Security</h2>
          <p>
            We do not store your credit card numbers or banking credentials. All online payments are
            processed through Razorpay using 256-bit SSL encryption adhering to PCI-DSS standards.
          </p>
        </section>

        <section className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft">
          <h2 className="font-display text-base font-bold text-foreground">
            3. Sharing with Local Vendors
          </h2>
          <p>
            To fulfill your orders, necessary contact details (name, delivery address, phone) are
            shared with the specific local vendor and delivery partner fulfilling your order.
          </p>
        </section>
      </main>
    </div>
  );
}
