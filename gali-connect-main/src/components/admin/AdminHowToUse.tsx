import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  UserPlus,
  Store,
  Bike,
  Layers,
  ClipboardList,
  Banknote,
  Settings,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  HowToUseShell,
  HowToSection,
  HowToStep,
  TipNote,
  WarnNote,
  HowToQuickLinks,
} from "@/components/system/how-to-use";

export function AdminHowToUse() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      navigate({ to: "/admin" });
    }
  }, [user, isAuthenticated, isAdmin, navigate]);

  if (!isAuthenticated || !isAdmin) return null;

  return (
    <HowToUseShell
      title="Admin — How to Use"
      subtitle="Your control room for the entire Vegamart platform: orders, vendors, delivery fleet, content, finance and platform settings."
      badge={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-600 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Admin Guide
        </span>
      }
    >
      <HowToQuickLinks
        links={[
          { label: "1 · Dashboard", href: "#dashboard" },
          { label: "2 · Orders", href: "#orders" },
          { label: "3 · Create Partner", href: "#create" },
          { label: "4 · Vendors", href: "#vendors" },
          { label: "5 · Delivery Fleet", href: "#fleet" },
          { label: "6 · Catalog", href: "#catalog" },
          { label: "7 · Content & Offers", href: "#content" },
          { label: "8 · Finance", href: "#finance" },
          { label: "9 · Platform Settings", href: "#settings" },
          { label: "10 · Support", href: "#support" },
        ]}
      />

      <HowToSection
        step="1"
        icon={<LayoutDashboard className="h-4 w-4 text-emerald-600" />}
        title="Dashboard overview"
        description="See how the whole marketplace is performing at a glance."
      >
        <HowToStep>
          The <strong>Dashboard</strong> shows key metrics — orders, GMV, active vendors, delivery
          partners, users and revenue.
        </HowToStep>
        <HowToStep>
          Use the left sidebar to jump to any management area. Your active section is highlighted.
        </HowToStep>
        <HowToStep>
          Notifications, maintenance alerts and pending reviews appear on the dashboard so nothing
          is missed.
        </HowToStep>
      </HowToSection>

      <HowToSection
        step="2"
        icon={<ShoppingCart className="h-4 w-4 text-emerald-600" />}
        title="Orders management"
        description="Monitor and intervene on orders across the platform."
      >
        <HowToStep>
          <strong>Orders</strong> lists all orders with filters by status, vendor and date.
        </HowToStep>
        <HowToStep>
          You can <strong>update order status</strong> on behalf of vendors or delivery partners
          when needed.
        </HowToStep>
        <HowToStep>
          To <strong>cancel</strong> an order: use the cancel action on a cancellable order. Paid
          orders are <strong>refunded automatically</strong> via Razorpay before the order is marked
          cancelled, and reserved inventory is released.
        </HowToStep>
        <HowToStep>
          Cancellations are recorded in the <strong>Audit Logs</strong> with the reason and the
          admin who performed them.
        </HowToStep>
        <WarnNote>
          Order cancellations are irreversible for that order. Verify the order status and reason
          before cancelling. Refunds run first — if a refund fails, the order stays unchanged so you
          can retry.
        </WarnNote>
      </HowToSection>

      <HowToSection
        step="3"
        icon={<UserPlus className="h-4 w-4 text-emerald-600" />}
        title="Create partner accounts"
        description="Onboard vendors and delivery partners manually."
      >
        <HowToStep>
          <strong>Create Partner</strong> lets you create a vendor or delivery partner account
          directly (useful for offline onboarding).
        </HowToStep>
        <HowToStep>
          Provide the partner's details; the system creates the user with the right role.
        </HowToStep>
        <HowToStep>New partners still need KYC approval before they can operate.</HowToStep>
      </HowToSection>

      <HowToSection
        step="4"
        icon={<Store className="h-4 w-4 text-emerald-600" />}
        title="Vendors management"
        description="Approve, review and manage every store on the platform."
      >
        <HowToStep>
          <strong>Vendors</strong> shows all applications. Review their <strong>KYC</strong> and
          approve or reject them.
        </HowToStep>
        <HowToStep>
          Open a vendor's detail to see their products, orders, earnings and membership plan.
        </HowToStep>
        <HowToStep>
          You can <strong>edit store details</strong>, including adding/removing{" "}
          <strong>banner images</strong> that appear in the store's cover carousel on their public
          page.
        </HowToStep>
        <HowToStep>
          <strong>Suspend</strong> a vendor for policy violations — they see an appeal screen and
          can contact support.
        </HowToStep>
        <TipNote>
          Adding banners on behalf of a vendor is a great way to promote new collections or
          festivals. All active banners show as a slider on the vendor page.
        </TipNote>
      </HowToSection>

      <HowToSection
        step="5"
        icon={<Bike className="h-4 w-4 text-emerald-600" />}
        title="Delivery fleet"
        description="Manage your delivery partners and their approvals."
      >
        <HowToStep>
          <strong>Delivery Boys</strong> lists all rider applications with their KYC status.
        </HowToStep>
        <HowToStep>
          Approve or reject riders after verifying their documents (license, Aadhaar, PAN).
        </HowToStep>
        <HowToStep>
          View a rider's stats — deliveries, earnings and ratings — and suspend riders who
          misbehave.
        </HowToStep>
        <HowToStep>
          Riders set their own delivery charges (base fee + per km); you can review these in their
          detail view.
        </HowToStep>
      </HowToSection>

      <HowToSection
        step="6"
        icon={<Layers className="h-4 w-4 text-emerald-600" />}
        title="Categories & products"
        description="Structure the catalog that customers browse."
      >
        <HowToStep>
          <strong>Categories</strong> — create and reorder categories. Add an{" "}
          <strong>image or icon</strong>; these show in the "Shop by Category" section on the
          homepage.
        </HowToStep>
        <HowToStep>
          Use <strong>sort order</strong> to control homepage position (lower numbers appear first).
        </HowToStep>
        <HowToStep>
          <strong>Products</strong> — moderate vendor products across the platform and clean up
          inactive or inappropriate listings.
        </HowToStep>
      </HowToSection>

      <HowToSection
        step="7"
        icon={<ClipboardList className="h-4 w-4 text-emerald-600" />}
        title="CMS, coupons, notifications & FAQs"
        description="Run marketing and keep users informed."
      >
        <HowToStep>
          <strong>CMS</strong> — manage banners, hero slides and marketing content shown to
          customers.
        </HowToStep>
        <HowToStep>
          <strong>Coupons</strong> — create and manage discount codes across the platform.
        </HowToStep>
        <HowToStep>
          <strong>Notifications</strong> — send announcements to all users or to specific segments
          (customers, vendors, riders).
        </HowToStep>
        <HowToStep>
          <strong>FAQs</strong> — maintain the public help center content.
        </HowToStep>
      </HowToSection>

      <HowToSection
        step="8"
        icon={<Banknote className="h-4 w-4 text-emerald-600" />}
        title="Reports, refunds & subscriptions"
        description="Track money and membership revenue."
      >
        <HowToStep>
          <strong>Reports</strong> — exports of orders, earnings and platform performance.
        </HowToStep>
        <HowToStep>
          <strong>Refunds</strong> — review and process refunds, including partial refunds, for
          delivered or disputed orders.
        </HowToStep>
        <HowToStep>
          <strong>Subscriptions</strong> — see every vendor's membership plan, renewals and
          payments.
        </HowToStep>
        <HowToStep>
          <strong>Membership Plans</strong> — define plan tiers, product limits, order limits and
          pricing.
        </HowToStep>
      </HowToSection>

      <HowToSection
        step="9"
        icon={<Settings className="h-4 w-4 text-emerald-600" />}
        title="Platform settings"
        description="Configure the whole platform in one place."
      >
        <HowToStep>
          <strong>Settings</strong> — set the platform name, currency and the default{" "}
          <strong>Tax Rate (%)</strong>.
        </HowToStep>
        <HowToStep>
          Configure the global <strong>Delivery Fee (₹)</strong> and{" "}
          <strong>Free Delivery Threshold (₹)</strong>. Vendors and delivery partners can override
          their own charges; your values are the defaults.
        </HowToStep>
        <HowToStep>
          Toggle <strong>Deliveries active</strong>, <strong>Multi-store checkout</strong> and{" "}
          <strong>Maintenance mode</strong>.
        </HowToStep>
        <HowToStep>
          Manage the support <strong>contact email & phone</strong> shown to users.
        </HowToStep>
        <TipNote>
          The tax rate you set here is the fallback for every vendor. Vendors who set their own{" "}
          <strong>Custom Tax Rate</strong> use their own value instead.
        </TipNote>
      </HowToSection>

      <HowToSection
        step="10"
        icon={<HelpCircle className="h-4 w-4 text-emerald-600" />}
        title="Support tickets & audit"
        description="Resolve user issues and keep a full audit trail."
      >
        <HowToStep>
          <strong>Support Tickets</strong> — triage and reply to customer, vendor and rider issues.
        </HowToStep>
        <HowToStep>
          <strong>Audit Logs</strong> — a chronological record of every sensitive action (logins,
          order updates, cancellations, refunds, vendor edits) with who did it.
        </HowToStep>
        <HowToStep>
          <strong>Users</strong> — review and manage user accounts across all roles.
        </HowToStep>
        <WarnNote>
          Always check the audit log before reversing any action. It is your source of truth for
          disputes.
        </WarnNote>
      </HowToSection>
    </HowToUseShell>
  );
}
