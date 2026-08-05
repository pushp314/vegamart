import { memo } from "react";
import { motion } from "framer-motion";
import { BadgeCheck } from "lucide-react";
import type { DiscoveryVendor } from "@/lib/discovery";
import { colorForCategory } from "@/lib/discovery";

interface VendorMarkerProps {
  x: number;
  y: number;
  vendor: DiscoveryVendor;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpenSheet: (id: string) => void;
}

const EMOJI: Record<string, string> = {
  vegetables: "🥦",
  fruits: "🍎",
  milk: "🥛",
  dairy: "🧀",
  bakery: "🥐",
  tea: "☕",
  food: "🍛",
  flowers: "💐",
  street: "🍢",
  groceries: "🛍️",
  meat: "🍗",
  eggs: "🥚",
};

function emojiFor(category: string | null | undefined): string {
  if (!category) return "🛒";
  const c = category.toLowerCase();
  for (const [key, emoji] of Object.entries(EMOJI)) {
    if (c.includes(key)) return emoji;
  }
  return "🛒";
}

export const VendorMarker = memo(function VendorMarker({
  x,
  y,
  vendor,
  selected,
  onSelect,
  onOpenSheet,
}: VendorMarkerProps) {
  const color = colorForCategory(vendor.category);

  return (
    <motion.button
      type="button"
      aria-label={`${vendor.business_name}, ${vendor.vendor_type === "roaming" ? "roaming cart" : "shop"}`}
      onClick={() => (selected ? onOpenSheet(vendor.id) : onSelect(vendor.id))}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: selected ? 1.22 : 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      style={{ left: x, top: y, transform: "translate(-50%, -100%)" }}
      className="absolute z-20 cursor-pointer touch-none select-none outline-none"
    >
      <span className="relative flex flex-col items-center">
        {/* selection halo */}
        {selected && (
          <motion.span
            layout
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -inset-2 rounded-full"
            style={{
              background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
            }}
          />
        )}
        {/* idle pulse ring */}
        <span
          className="absolute -inset-1.5 animate-ping-slow rounded-full"
          style={{ border: `1.5px solid ${color}88`, animationDuration: "2.2s" }}
        />
        {/* marker pin */}
        <span
          className={`relative grid place-items-center rounded-full border-2 border-white shadow-lg transition-shadow ${
            selected ? "h-11 w-11" : "h-9 w-9"
          }`}
          style={{
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            boxShadow: selected
              ? `0 8px 22px -6px ${color}99, 0 0 0 4px ${color}22`
              : "0 6px 16px -6px rgba(0,0,0,0.45)",
          }}
        >
          <span className="text-base leading-none">{emojiFor(vendor.category)}</span>
          {vendor.is_verified && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-white shadow-sm">
              <BadgeCheck className="h-3.5 w-3.5 fill-sky-500 text-white" />
            </span>
          )}
        </span>
        {/* label */}
        <span
          className={`mt-1 max-w-[110px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-md ${
            selected
              ? "bg-foreground text-background shadow-md"
              : "bg-white/85 text-foreground shadow-sm ring-1 ring-black/5"
          }`}
        >
          {vendor.business_name}
        </span>
        {/* pin tip */}
        <span
          className="block h-1.5 w-1.5 -mt-[2px] rotate-45 rounded-[2px] border-b border-r"
          style={{ background: color }}
        />
      </span>
    </motion.button>
  );
});
