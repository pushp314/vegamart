import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img src="/icons/icon-512.png" alt="Vegamart" className={cn("object-contain", className)} />
  );
}
