import type { ReactNode } from "react";
import { Lightbulb, AlertTriangle } from "lucide-react";

export function HowToUseShell({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-soft relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {badge}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1">
              How to use guide
            </span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-black tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function HowToSection({
  step,
  icon,
  title,
  description,
  children,
}: {
  step: string;
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 shadow-soft">
      <div className="flex items-start gap-3 mb-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 text-sm font-black">
          {step}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-display text-base md:text-lg font-bold">{title}</h2>
          </div>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-2 pl-1">{children}</div>
    </section>
  );
}

export function HowToStep({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm leading-relaxed">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <div className="min-w-0 text-foreground/90">{children}</div>
    </div>
  );
}

export function TipNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-4 py-3 text-sm">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <div className="text-emerald-900 dark:text-emerald-200 leading-relaxed">{children}</div>
    </div>
  );
}

export function WarnNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="text-amber-900 dark:text-amber-200 leading-relaxed">{children}</div>
    </div>
  );
}

export function HowToQuickLinks({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 md:p-6 shadow-soft">
      <h2 className="font-display text-base font-bold mb-4">Jump to a section</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-4 py-2 text-xs font-bold text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
