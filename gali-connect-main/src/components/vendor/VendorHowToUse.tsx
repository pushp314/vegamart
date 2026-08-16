import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Store,
  Power,
  Package,
  ClipboardList,
  ImagePlus,
  Bike,
  MapPin,
  Wallet,
  Ticket,
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

export function VendorHowToUse() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user && user.role !== "vendor") {
      navigate({ to: "/vendor" });
    }
  }, [user, isAuthenticated, navigate]);

  if (!isAuthenticated || (user && user.role !== "vendor")) return null;

  return (
    <HowToUseShell
      title="Vendor — How to Use"
      subtitle="A complete walkthrough of your Vendor Hub: setting up your store, adding products, managing orders, and configuring your delivery & tax preferences."
      badge={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1">
          <Store className="h-3.5 w-3.5" /> Seller Guide
        </span>
      }
    >
      <HowToQuickLinks
        links={[
          { label: "1 · Onboarding", href: "#onboarding" },
          { label: "2 · Open Store", href: "#open" },
          { label: "3 · Products", href: "#products" },
          { label: "4 · Orders", href: "#orders" },
          { label: "5 · Branding & Banners", href: "#branding" },
          { label: "6 · Delivery & Tax", href: "#delivery" },
          { label: "7 · Location", href: "#location" },
          { label: "8 · Money", href: "#earnings" },
          { label: "9 · Extras", href: "#extras" },
        ]}
      />

      <HowToSection
        step="1"
        icon={<Store className="h-4 w-4 text-emerald-600" />}
        title="Set up your store"
        description="Complete your profile, KYC and membership to start accepting orders."
      >
        <HowToStep>
          Apply from <strong>Become a Vendor</strong> on the homepage or the vendor login page.
        </HowToStep>
        <HowToStep>
          Fill in your <strong>business details</strong> — name, address, category, logo,
          description and store phone number.
        </HowToStep>
        <HowToStep>
          Submit your <strong>KYC documents</strong> (identity & business proof) and wait for admin
          approval.
        </HowToStep>
        <HowToStep>
          Once approved, pick a <strong>membership plan</strong>. Your plan decides your product
          limit, daily order limit and premium features.
        </HowToStep>
        <TipNote>
          Your store stays in "Under Review" until the admin approves it. You will be notified the
          moment you go live.
        </TipNote>
      </HowToSection>

      <HowToSection
        step="2"
        icon={<Power className="h-4 w-4 text-emerald-600" />}
        title="Open & close your store"
        description="Control when customers can order from you."
      >
        <HowToStep>
          Use the <strong>Open Store / Close Store</strong> toggle on your vendor dashboard to go
          live.
        </HowToStep>
        <HowToStep>
          An <strong>online</strong> store appears in search, categories and nearby listings.
        </HowToStep>
        <HowToStep>
          When offline, customers can still browse and save items, but cannot place orders.
        </HowToStep>
        <WarnNote>
          Only approved vendors can open their store. If your store is suspended, you will see an
          appeal option to contact support.
        </WarnNote>
      </HowToSection>

      <HowToSection
        step="3"
        icon={<Package className="h-4 w-4 text-emerald-600" />}
        title="Add & manage products"
        description="Build your catalog so customers can order from you."
      >
        <HowToStep>
          Go to <strong>Products</strong> in the left menu and tap <strong>Add Product</strong>.
        </HowToStep>
        <HowToStep>
          Enter the product name, price, unit (kg, dozen, piece), category and an image. Use the
          bulk upload option to add many products at once via CSV.
        </HowToStep>
        <HowToStep>
          Mark products <strong>available</strong> so they show in your store page. Set stock or
          availability status per item.
        </HowToStep>
        <TipNote>
          Good photos and accurate units get more orders. Keep your bestsellers available and update
          prices as your costs change.
        </TipNote>
      </HowToSection>

      <HowToSection
        step="4"
        icon={<ClipboardList className="h-4 w-4 text-emerald-600" />}
        title="Manage orders"
        description="Follow the status flow to fulfill every order correctly."
      >
        <HowToStep>
          <strong>Orders</strong> shows all incoming orders. Accept/reject new ones from the order
          list.
        </HowToStep>
        <HowToStep>
          Move orders through the lifecycle:{" "}
          <strong>Confirmed → Preparing → Packed → Ready for pickup</strong>.
        </HowToStep>
        <HowToStep>
          For self-pickup, the customer picks up at your store after advance payment (if enabled).
        </HowToStep>
        <HowToStep>
          For delivery, a delivery partner is assigned or your own shop delivery team fulfills the
          order.
        </HowToStep>
        <HowToStep>
          You can <strong>cancel</strong> orders that have not started delivery. Paid orders are
          automatically refunded.
        </HowToStep>
        <WarnNote>
          Cancel only when necessary. Excessive cancellations hurt your rating and can affect your
          membership.
        </WarnNote>
      </HowToSection>

      <HowToSection
        step="5"
        icon={<ImagePlus className="h-4 w-4 text-violet-500" />}
        title="Store branding, logo & banners"
        description="Make your store stand out with a logo and a cover carousel."
      >
        <HowToStep>
          Go to <strong>Settings → Store Branding & Logo</strong> to upload or paste a logo image.
        </HowToStep>
        <HowToStep>
          In <strong>Store Banners / Cover Images</strong>, upload one or more banner images. They
          appear as a <strong>carousel slider with dot indicators</strong> on your public store
          page.
        </HowToStep>
        <HowToStep>
          Add as many banners as you like and remove any that are outdated. Changes apply after you
          tap <strong>Save Settings</strong>.
        </HowToStep>
        <TipNote>
          The admin can also add banners for your store from the admin panel — the slider shows all
          active banners.
        </TipNote>
      </HowToSection>

      <HowToSection
        step="6"
        icon={<Bike className="h-4 w-4 text-blue-600" />}
        title="Delivery options, fees & tax"
        description="Set the services you offer and the charges you control — all separate from delivery partners."
      >
        <HowToStep>
          In <strong>Settings → Delivery Options</strong>, toggle{" "}
          <strong>Provide Vendor Delivery</strong> if your shop delivers by itself, and set your{" "}
          <strong>Standard Delivery Fee (₹)</strong> and{" "}
          <strong>Free Delivery Order Threshold (₹)</strong>.
        </HowToStep>
        <HowToStep>
          Customers will see <strong>Shop delivery</strong> in checkout when you enable vendor
          delivery. This is different from <strong>Delivery Partner</strong> delivery, which uses
          the partner's own charges.
        </HowToStep>
        <HowToStep>
          Set <strong>Advance Payment for Self Pickup (%)</strong> — the share of the order paid
          online before pickup. Leave 0 for no advance.
        </HowToStep>
        <HowToStep>
          In <strong>Tax & Compliance</strong>, set a <strong>Custom Tax Rate (%)</strong> if you
          want your own GST rate, or leave it blank to use the platform default set by the admin.
        </HowToStep>
        <HowToStep>
          GSTIN is optional and displayed on your store for customer confidence.
        </HowToStep>
        <TipNote>
          Your charges are independent of delivery partners and the admin's platform fees. Set rates
          that cover your costs and attract customers.
        </TipNote>
      </HowToSection>

      <HowToSection
        step="7"
        icon={<MapPin className="h-4 w-4 text-emerald-600" />}
        title="Location & roaming cart"
        description="Tell customers where you are."
      >
        <HowToStep>
          <strong>Location</strong> lets you set your store address, landmark and delivery radius.
        </HowToStep>
        <HowToStep>
          Roaming vendors can share a <strong>live daily location</strong> so customers see where
          the cart is right now.
        </HowToStep>
        <HowToStep>
          Your store page shows a map with directions for customers to find you.
        </HowToStep>
      </HowToSection>

      <HowToSection
        step="8"
        icon={<Wallet className="h-4 w-4 text-emerald-600" />}
        title="Earnings, membership & reviews"
        description="Track how your store is performing."
      >
        <HowToStep>
          <strong>Earnings</strong> shows your revenue, pending settlements and order history.
        </HowToStep>
        <HowToStep>
          <strong>Membership</strong> shows your current plan, limits and upgrade options.
        </HowToStep>
        <HowToStep>
          <strong>Reviews</strong> shows what customers say. Reply to keep your rating high.
        </HowToStep>
        <HowToStep>
          <strong>Analytics</strong> (premium) gives deeper insights into orders and traffic.
        </HowToStep>
      </HowToSection>

      <HowToSection
        step="9"
        icon={<Ticket className="h-4 w-4 text-amber-500" />}
        title="Coupons & support"
        description="Drive more orders and get help when you need it."
      >
        <HowToStep>
          Create <strong>Coupons</strong> to offer discounts and attract customers.
        </HowToStep>
        <HowToStep>
          Use <strong>Overview</strong> quick actions to jump between products, orders, location and
          settings.
        </HowToStep>
        <HowToStep>
          Stuck? Contact Vegamart support — the admin can also see your store and help with
          approvals, payments and disputes.
        </HowToStep>
      </HowToSection>
    </HowToUseShell>
  );
}
