import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { Trash2, Heart, Minus, Plus } from "lucide-react";
import { useRef } from "react";

type Item = {
  id: string;
  name: string;
  image: string;
  unit?: string;
  price: number;
  qty: number;
};

export function SwipeableCartItem({
  item,
  onRemove,
  onSave,
  onQty,
}: {
  item: Item;
  onRemove: (id: string) => void;
  onSave?: (id: string) => void;
  onQty: (id: string, delta: number) => void;
}) {
  const x = useMotionValue(0);
  const removing = useRef(false);
  const bgOpacity = useTransform(x, [-160, -60, 0], [1, 0.6, 0]);
  const iconScale = useTransform(x, [-160, -80, 0], [1.15, 1, 0.8]);
  const saveOpacity = useTransform(x, [0, 60, 160], [0, 0.6, 1]);
  const saveScale = useTransform(x, [0, 80, 160], [0.8, 1, 1.15]);

  const onEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x;
    if (dx < -120) {
      removing.current = true;
      animate(x, -window.innerWidth, { duration: 0.25, ease: "easeIn" }).then(() =>
        onRemove(item.id),
      );
    } else if (dx > 120 && onSave) {
      animate(x, window.innerWidth, { duration: 0.25, ease: "easeIn" }).then(() => {
        onSave(item.id);
      });
    } else {
      animate(x, 0, { type: "spring", stiffness: 320, damping: 28 });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        transition: { duration: 0.22 },
      }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Delete background (left swipe) */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 flex items-center justify-end rounded-2xl bg-gradient-to-l from-destructive to-destructive pr-6 text-primary-foreground"
      >
        <motion.div style={{ scale: iconScale }} className="flex flex-col items-center gap-1">
          <Trash2 className="h-6 w-6" />
          <span className="text-xs font-bold">Remove</span>
        </motion.div>
      </motion.div>
      {/* Save background (right swipe) */}
      {onSave && (
        <motion.div
          style={{ opacity: saveOpacity }}
          className="absolute inset-0 flex items-center rounded-2xl bg-gradient-to-r from-brand to-brand pl-6 text-primary-foreground"
        >
          <motion.div style={{ scale: saveScale }} className="flex flex-col items-center gap-1">
            <Heart className="h-6 w-6 fill-white" />
            <span className="text-xs font-bold">Saved</span>
          </motion.div>
        </motion.div>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: -220, right: onSave ? 220 : 0 }}
        dragElastic={0.15}
        style={{ x }}
        onDragEnd={onEnd}
        className="relative flex gap-4 rounded-2xl border bg-card p-4 shadow-soft touch-pan-y tap-highlight-none"
      >
        <img
          src={item.image}
          alt={item.name}
          className="h-20 w-20 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{item.name}</h3>
              <p className="text-xs text-muted-foreground">{item.unit}</p>
            </div>
            <button
              onClick={() => {
                removing.current = true;
                animate(x, -window.innerWidth, { duration: 0.22 }).then(() => onRemove(item.id));
              }}
              aria-label="Remove"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:inline-grid hidden"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center rounded-lg border bg-background">
              <button
                onClick={() => onQty(item.id, -1)}
                className="grid h-8 w-8 place-items-center rounded-l-lg hover:bg-muted"
                aria-label="Decrease"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
              <button
                onClick={() => onQty(item.id, 1)}
                className="grid h-8 w-8 place-items-center rounded-r-lg hover:bg-muted"
                aria-label="Increase"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="font-bold">₹{item.price * item.qty}</div>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground md:hidden">
            Swipe left to remove{onSave ? " · right to save" : ""}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
