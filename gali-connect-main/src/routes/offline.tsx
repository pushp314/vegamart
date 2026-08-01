import { createFileRoute, Link } from "@tanstack/react-router";
import { WifiOff, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/offline")({
  head: () => ({ meta: [{ title: "Offline — Vegamart" }] }),
  component: OfflinePage,
});

function OfflinePage() {
  return (
    <div className="min-h-screen bg-background grid place-items-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-100 text-amber-600">
          <WifiOff className="h-10 w-10" />
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">You are Offline</h1>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Please check your internet connection. Vegamart will reconnect automatically when back
            online.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-xs px-6 py-3 shadow-xs hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" /> Try Reconnecting
        </button>
      </div>
    </div>
  );
}
