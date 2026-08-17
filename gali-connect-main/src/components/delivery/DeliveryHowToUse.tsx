import { useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Bike,
  Power,
  Radio,
  Navigation,
  Wallet,
  Settings,
  IndianRupee,
  ShieldCheck,
  ChevronLeft,
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

export function DeliveryHowToUse() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/delivery" });
      return;
    }
    if (user && user.role !== "delivery") {
      navigate({ to: "/delivery" });
    }
  }, [user, isAuthenticated, navigate]);

  if (!isAuthenticated || (user && user.role !== "delivery")) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 space-y-6">
      <Link
        to="/delivery"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to rider dashboard
      </Link>
      <HowToUseShell
        title="Delivery Partner — How to Use"
        subtitle="Everything you need to start delivering with Vegamart. Read this guide once and you will be up and riding in no time."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-600 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1">
            <Bike className="h-3.5 w-3.5" /> Rider Guide
          </span>
        }
      >
        <HowToQuickLinks
          links={[
            { label: "1 · Get Approved", href: "#onboarding" },
            { label: "2 · Go Online", href: "#online" },
            { label: "3 · Radar & Accept", href: "#radar" },
            { label: "4 · Complete Delivery", href: "#deliver" },
            { label: "5 · Earnings", href: "#earnings" },
            { label: "6 · Set Charges", href: "#charges" },
            { label: "7 · Profile & Help", href: "#support" },
          ]}
        />

        <HowToSection
          step="1"
          icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
          title="Create your account & get approved"
          description="You must have a delivery partner account with completed KYC before you can receive orders."
        >
          <HowToStep>
            Apply from the <strong>delivery page</strong> (top right menu → Delivery) or from{" "}
            <strong>Become a delivery partner</strong> on the homepage.
          </HowToStep>
          <HowToStep>
            Submit your <strong>KYC documents</strong> — Driving License, Aadhaar and PAN. These are
            required by law and to verify your identity.
          </HowToStep>
          <HowToStep>
            Wait for the <strong>admin review</strong>. Once approved your status changes to{" "}
            <strong>Approved</strong> and you can go online. Rejected applications show the reason —
            fix the documents and resubmit.
          </HowToStep>
          <TipNote>
            Keep your documents handy. Approval usually takes 1–2 business days. You will be
            notified when it is done.
          </TipNote>
        </HowToSection>

        <HowToSection
          step="2"
          icon={<Power className="h-4 w-4 text-emerald-600" />}
          title="Go online"
          description="New orders only appear when you are online. The toggle is at the top right of your dashboard."
        >
          <HowToStep>
            Tap the <strong>ONLINE / OFFLINE</strong> button at the top right corner of your rider
            dashboard.
          </HowToStep>
          <HowToStep>
            The status bar turns green with an <strong>ONLINE</strong> label when you are live.
          </HowToStep>
          <HowToStep>
            Keep the app open while online. Orders are pushed to you in real time.
          </HowToStep>
          <WarnNote>
            Go offline when you are taking a break, or when your vehicle or area changes. You can
            toggle back online any time.
          </WarnNote>
        </HowToSection>

        <HowToSection
          step="3"
          icon={<Radio className="h-4 w-4 text-emerald-600" />}
          title="Radar — find & accept orders"
          description="The Radar tab lists nearby VegaMart Delivery Partner requests after vendor confirmation."
        >
          <HowToStep>
            <strong>Order Flow:</strong> Customer places order → Vendor accepts & confirms order → Order appears on your Radar for delivery.
          </HowToStep>
          <HowToStep>
            Open the <strong>Radar</strong> tab (bottom navigation, first icon) to see available
            delivery requests. (Self Pickup and Shop's own delivery orders are filtered out).
          </HowToStep>
          <HowToStep>
            Each card shows the <strong>pickup vendor</strong>, <strong>dropoff customer</strong>,
            and the <strong>delivery fee</strong> for the order.
          </HowToStep>
          <HowToStep>
            Tap <strong>Accept Delivery</strong> and enter your <strong>ETA</strong> (time to reach
            the vendor in minutes).
          </HowToStep>
          <HowToStep>
            The order moves to your <strong>Active</strong> list. New requests refresh every few
            seconds while you are online.
          </HowToStep>
          <TipNote>
            Only accept orders you can reach in time. Orders only appear after the vendor has confirmed preparation.
          </TipNote>
        </HowToSection>

        <HowToSection
          step="4"
          icon={<Navigation className="h-4 w-4 text-emerald-600" />}
          title="Pickup → deliver & confirm with OTP"
          description="Every delivery follows a simple flow. The app guides you step by step."
        >
          <HowToStep>
            <strong>Reach the vendor</strong> — tap <strong>View Route</strong> on an active order
            to open the map with the route to pickup.
          </HowToStep>
          <HowToStep>
            Tap <strong>Picked Up</strong> once the vendor hands over the order.
          </HowToStep>
          <HowToStep>
            Tap <strong>Out for Delivery</strong> when you leave the vendor with the order.
          </HowToStep>
          <HowToStep>
            At the customer, tap <strong>Delivered</strong> and ask the customer for their{" "}
            <strong>6-digit delivery OTP</strong> (shown in their order tracking). Enter the OTP to
            confirm.
          </HowToStep>
          <HowToStep>
            For COD orders, collect the amount shown (<strong>Collect: ₹…</strong>) before entering
            the OTP.
          </HowToStep>
          <WarnNote>
            Never mark an order delivered without the correct OTP. Fake confirmations lead to
            account suspension and loss of earnings.
          </WarnNote>
        </HowToSection>

        <HowToSection
          step="5"
          icon={<Wallet className="h-4 w-4 text-emerald-600" />}
          title="Track your earnings"
          description="Your wallet and history show every rupee you earn."
        >
          <HowToStep>
            The <strong>Wallet</strong> tab shows today's earnings, completed deliveries and your
            rating.
          </HowToStep>
          <HowToStep>
            The <strong>History</strong> tab lists every completed delivery with the fee earned.
          </HowToStep>
          <HowToStep>
            Delivery fees are added to your balance once the delivery is confirmed by the customer's
            OTP.
          </HowToStep>
          <HowToStep>
            The performance strip at the top shows <strong>Successful</strong> deliveries,{" "}
            <strong>Active</strong> orders and <strong>Today's earnings</strong> at a glance.
          </HowToStep>
        </HowToSection>

        <HowToSection
          step="6"
          icon={<IndianRupee className="h-4 w-4 text-emerald-600" />}
          title="Set your own delivery charges"
          description="Your charges are separate from the vendor's charges — you decide your own fee structure."
        >
          <HowToStep>
            Open the <strong>Profile</strong> tab (tap your name at the top).
          </HowToStep>
          <HowToStep>
            In the <strong>Delivery Charges</strong> card, set your{" "}
            <strong>Base Delivery Fee (₹)</strong> and <strong>Fee per km (₹)</strong>.
          </HowToStep>
          <HowToStep>
            Tap <strong>Save Delivery Charges</strong>. These apply when you are assigned as the
            delivery partner for an order.
          </HowToStep>
          <TipNote>
            Vendors set their own delivery options and fees for shop delivery. Your charges are
            independent — set them based on distance and fuel cost.
          </TipNote>
        </HowToSection>

        <HowToSection
          step="7"
          icon={<Settings className="h-4 w-4 text-emerald-600" />}
          title="Profile, settings & help"
          description="Manage your vehicle details, availability and account."
        >
          <HowToStep>
            <strong>Profile</strong> — update your vehicle type, vehicle number and driving license.
          </HowToStep>
          <HowToStep>
            <strong>Settings</strong> — toggle your online availability and review your KYC/account
            status.
          </HowToStep>
          <HowToStep>
            Sign out securely from the Settings tab when you are done for the day.
          </HowToStep>
          <TipNote>
            Stuck? Contact Vegamart support for rider issues — they help with KYC, earnings and
            delivery disputes.
          </TipNote>
        </HowToSection>
      </HowToUseShell>
    </div>
  );
}
