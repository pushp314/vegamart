import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import appCss from "../styles.css?url";
import { registerServiceWorker } from "../lib/pwa";
import { BottomNav } from "../components/layout/bottom-nav";
import { Navbar } from "../components/layout/navbar";
import { SplashScreen } from "../components/system/splash-screen";
import { NetworkIndicator } from "../components/system/network-indicator";
import { InstallAppBanner } from "../components/system/install-app-banner";
import { ClientOnly } from "../components/system/client-only";
import { AuthProvider } from "../context/auth-context";
import { CartProvider } from "../context/cart-context";
import { WishlistProvider } from "../context/wishlist-context";
import { Toaster } from "../components/ui/sonner";
import { checkMaintenanceStatus } from "../lib/api";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Vegamart" },
      { name: "theme-color", content: "#16a34a" },
      { title: "Vegamart — Discover Everything Around You" },
      {
        name: "description",
        content:
          "India's hyperlocal marketplace connecting you with trusted local street vendors and neighbourhood shops. Fresh groceries, chai, street food and more — delivered in minutes.",
      },
      { name: "author", content: "Vegamart" },
      { name: "theme-color", content: "#ffffff" },
      { property: "og:title", content: "Vegamart — Discover Everything Around You" },
      {
        property: "og:description",
        content: "Order from your favourite local vendors. Delivered in minutes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://vegamart.in/favicon.ico" },
      { property: "og:image:width", content: "512" },
      { property: "og:image:height", content: "512" },
      { property: "og:image:alt", content: "Vegamart logo" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://vegamart.in/favicon.ico" },
      { name: "twitter:title", content: "Vegamart" },
      { name: "twitter:description", content: "Your neighbourhood, delivered." },
      { property: "og:site_name", content: "Vegamart" },
      { property: "og:url", content: "https://vegamart.in" },
      { name: "thumbnail", content: "https://vegamart.in/favicon.ico" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "shortcut icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "icon", href: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "image_src", href: "https://vegamart.in/icons/icon-512.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Vegamart",
      "url": "https://vegamart.in",
      "logo": {
        "@type": "ImageObject",
        "url": "https://vegamart.in/icons/icon-512.png",
        "width": 512,
        "height": 512
      },
      "image": "https://vegamart.in/icons/icon-512.png"
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Vegamart",
      "url": "https://vegamart.in",
      "image": "https://vegamart.in/icons/icon-512.png"
    }
  ];

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AnimatedOutlet() {
  const key = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Portal routes (vendor / delivery / admin) have their own chrome — hide the
  // customer-facing navbar & bottom nav so other roles only see their portal.
  // The /search page is a full-screen overlay with its own search header, so it
  // also hides the desktop navbar to avoid showing two search bars.
  const isPortalRoute =
    pathname.startsWith("/vendor") ||
    pathname.startsWith("/delivery") ||
    pathname.startsWith("/admin");
  const isFullScreenRoute = isPortalRoute || pathname.startsWith("/search");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <ClientOnly>
              <SplashScreen />
              <NetworkIndicator />
              <MaintenanceWatcher />
            </ClientOnly>
            {!isFullScreenRoute && <Navbar />}
            <AnimatedOutlet />
            <ClientOnly>
              <InstallAppBanner />
            </ClientOnly>
            {!isPortalRoute && <BottomNav />}
            <Toaster position="top-center" />
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function MaintenanceWatcher() {
  const { data: statusRes } = useQuery({
    queryKey: ["maintenanceStatus"],
    queryFn: () => checkMaintenanceStatus(),
    refetchInterval: 30000,
    retry: false,
  });

  useEffect(() => {
    if (
      statusRes?.success === true &&
      statusRes.data?.maintenance === true &&
      !window.location.pathname.startsWith("/maintenance")
    ) {
      window.location.assign("/maintenance");
    }
  }, [statusRes]);

  return null;
}
