import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/system/logo";

export function AppHeader({
  title,
  subtitle,
  back = true,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else router.navigate({ to: "/" });
  };
  return (
    <header className="md:hidden sticky top-0 z-30 bg-background/90 backdrop-blur border-b">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-3 pt-safe">
        {back ? (
          <button
            type="button"
            aria-label="Back"
            onClick={goBack}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted tap-highlight-none"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <Link to="/" aria-label="Home" className="grid h-10 w-10 place-items-center rounded-full">
            <Logo className="h-9 w-9" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[17px] font-bold leading-tight">{title}</div>
          {subtitle ? (
            <div className="truncate text-[11px] text-muted-foreground leading-tight">
              {subtitle}
            </div>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
}
