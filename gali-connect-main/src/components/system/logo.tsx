import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img src="/favicon.ico" alt="Vegamart" className={cn("object-contain", className)} />
  );
}
