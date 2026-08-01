import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Heart, Store, ShieldCheck, Zap } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About Us — Vegamart" }] }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <AppHeader title="About Vegamart" subtitle="Har Gali Banegi Live Market" />

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <div className="rounded-3xl bg-emerald-900 text-white p-8 space-y-4 shadow-soft">
          <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[11px] font-bold px-3 py-1 rounded-full">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Our Mission
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
            Empowering Every Local Vendor Across India
          </h1>
          <p className="text-sm text-emerald-100 leading-relaxed max-w-2xl">
            Vegamart is India's premier hyperlocal marketplace connecting neighbourhood street
            vendors, sabziwalas, bakeries, tea stalls, and grocery stores directly with nearby
            customers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-3xl border bg-card p-5 space-y-2 text-center shadow-soft">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-primary">
              <Store className="h-6 w-6" />
            </div>
            <h3 className="font-display text-base font-bold">12,000+ Vendors</h3>
            <p className="text-xs text-muted-foreground">Local neighbourhood sellers onboarded</p>
          </div>

          <div className="rounded-3xl border bg-card p-5 space-y-2 text-center shadow-soft">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="font-display text-base font-bold">12–15 Min Delivery</h3>
            <p className="text-xs text-muted-foreground">Hyperlocal instant fulfilment</p>
          </div>

          <div className="rounded-3xl border bg-card p-5 space-y-2 text-center shadow-soft">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-600">
              <Heart className="h-6 w-6" />
            </div>
            <h3 className="font-display text-base font-bold">Zero Platform Tax</h3>
            <p className="text-xs text-muted-foreground">Direct income to local street sellers</p>
          </div>
        </div>

        <div className="rounded-3xl border bg-card p-6 space-y-3 shadow-soft">
          <h2 className="font-display text-xl font-bold">Why Live Gali Vendor?</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            While corporate quick-commerce apps charge high commissions and replace local vendors
            with dark warehouses, Vegamart brings technology to the streets. We digitize every local
            vegetable cart, juice stall, and neighbourhood grocery store so they thrive in the
            digital era.
          </p>
        </div>
      </main>
    </div>
  );
}
