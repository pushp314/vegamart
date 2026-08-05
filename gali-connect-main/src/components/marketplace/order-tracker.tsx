import type React from "react";
import { CheckCircle2, Clock, ChefHat, Bike, Home } from "lucide-react";

export type OrderStatus = string;

const STAGES: {
  status: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { status: "pending", label: "Order Placed", icon: Clock },
  { status: "confirmed", label: "Confirmed by Vendor", icon: CheckCircle2 },
  { status: "preparing", label: "Packing / Preparing", icon: ChefHat },
  { status: "out_for_delivery", label: "Out for Delivery", icon: Bike },
  { status: "delivered", label: "Delivered", icon: Home },
];

function statusRank(status: string): number {
  switch (String(status).toLowerCase()) {
    case "pending":
      return 0;
    case "confirmed":
      return 1;
    case "preparing":
    case "packed":
    case "ready_for_pickup":
      return 2;
    case "picked_up":
    case "out_for_delivery":
      return 3;
    case "delivered":
      return 4;
    default:
      return -1;
  }
}

export function OrderTracker({
  status = "out_for_delivery",
  eta,
}: {
  status?: OrderStatus;
  eta?: string;
}) {
  const currentIndex = Math.max(0, statusRank(status));

  return (
    <div className="rounded-3xl bg-card border p-5 shadow-soft space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Live Delivery Tracking
          </span>
          <h3 className="font-display text-lg font-bold text-foreground">
            {status === "delivered"
              ? "Delivered 🎉"
              : status === "cancelled"
                ? "Order Cancelled"
                : eta
                  ? `Arriving in ${eta}`
                  : status === "out_for_delivery"
                    ? "Rider on the way"
                    : "Order in progress"}
          </h3>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-primary animate-pulse">
          <Bike className="h-5 w-5" />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative pt-2">
        <div className="flex justify-between items-center relative z-10">
          {STAGES.map((s, idx) => {
            const Icon = s.icon;
            const completed = idx <= currentIndex;
            const current = idx === currentIndex;

            return (
              <div key={s.status} className="flex flex-col items-center gap-1.5">
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-all ${
                    completed
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={`text-[10px] font-semibold text-center max-w-[64px] leading-tight ${
                    current
                      ? "text-primary font-bold"
                      : completed
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Track Line */}
        <div className="absolute top-6 left-4 right-4 h-1 bg-muted -z-0">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(currentIndex / (STAGES.length - 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
