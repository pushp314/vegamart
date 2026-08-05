import { memo } from "react";
import { motion } from "framer-motion";
import { DISCOVERY_CATEGORIES } from "@/lib/discovery";

interface CategoryPillsProps {
  selected: string;
  onSelect: (id: string) => void;
  countByCategory: Record<string, number>;
}

export const CategoryPills = memo(function CategoryPills({
  selected,
  onSelect,
  countByCategory,
}: CategoryPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
      {DISCOVERY_CATEGORIES.map((cat) => {
        const active = selected === cat.id;
        const count = countByCategory[cat.id];
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
              active ? "text-background" : "bg-white/80 text-foreground ring-1 ring-black/5"
            }`}
          >
            {active && (
              <motion.span
                layoutId="category-pill"
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="absolute inset-0 rounded-full"
                style={{ background: cat.color }}
              />
            )}
            <span className="relative z-10 text-sm leading-none">{cat.emoji}</span>
            <span className="relative z-10">{cat.label}</span>
            {typeof count === "number" && count > 0 && (
              <span
                className={`relative z-10 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  active ? "bg-background/25 text-background" : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});
