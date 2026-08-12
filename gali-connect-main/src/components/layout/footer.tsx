import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/system/logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t bg-card hidden md:block">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <Logo className="h-10 w-10" />
              <div>
                <div className="font-bold font-display text-lg">Vegamart</div>
                <div className="text-xs text-muted-foreground">Discover Everything Around You</div>
              </div>
            </div>
            <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
              Bringing India's beloved street vendors, sabziwalas, bakeries, and local shops
              directly to your doorstep. Fresh, fast, and fair.
            </p>
          </div>

          <div>
            <div className="mb-4 text-xs font-bold uppercase tracking-wider text-foreground">
              Company
            </div>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li>
                <Link to="/about" className="hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/vendors" className="hover:text-primary transition-colors">
                  Live Vendor Map
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-4 text-xs font-bold uppercase tracking-wider text-foreground">
              For Partners
            </div>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li>
                <Link
                  to="/become-vendor"
                  className="hover:text-primary font-semibold text-primary transition-colors"
                >
                  Become a Vendor
                </Link>
              </li>
              <li>
                <Link to="/vendor" className="hover:text-primary transition-colors">
                  Vendor Portal
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-primary transition-colors">
                  Admin Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-4 text-xs font-bold uppercase tracking-wider text-foreground">
              Support & Legal
            </div>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li>
                <Link to="/faq" className="hover:text-primary transition-colors">
                  Help Center & FAQ
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="hover:text-primary transition-colors">
                  Refund & Cancellation
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t pt-6 text-xs text-muted-foreground">
          <div>© 2026 Vegamart. Made with 💚 in Sakti, Chhattisgarh.</div>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:underline">
              Terms
            </Link>
            <Link to="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link to="/refund-policy" className="hover:underline">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
