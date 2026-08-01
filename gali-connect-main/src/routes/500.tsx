import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertOctagon, RefreshCw, Home } from "lucide-react";

export const Route = createFileRoute("/500")({
  head: () => ({ meta: [{ title: "500 Internal Server Error — Vegamart" }] }),
  component: ServerErrorPage,
});

function ServerErrorPage() {
  return (
    <div className="min-h-screen bg-background grid place-items-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-rose-100 text-rose-600">
          <AlertOctagon className="h-10 w-10" />
        </div>

        <div>
          <h1 className="font-display text-5xl font-bold text-foreground">500</h1>
          <h2 className="mt-2 text-xl font-bold text-foreground">Internal Server Error</h2>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Something went wrong on our servers. Our technical team has been notified.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-xs px-5 py-3 shadow-xs hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" /> Refresh Page
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-2xl bg-card border font-bold text-xs px-5 py-3 hover:bg-muted"
          >
            <Home className="h-4 w-4" /> Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
