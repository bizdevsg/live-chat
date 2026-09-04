import type { HTMLAttributes, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/components/ui/cn";

type DashboardMetric = {
  label: string;
  value: string;
  detail?: string;
};

export function DashboardPage({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={cn(
        "scrollbar-thin relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_78%_0%,rgba(212,175,55,0.08),transparent_26rem)] px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-7",
        className,
      )}
      {...props}
    />
  );
}

export function DashboardPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="rounded-2xl border border-ink-600 bg-ink-800/70 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.12)] sm:px-5 sm:py-5 md:px-6 md:py-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

export function DashboardPageMetrics({ items, className }: { items: DashboardMetric[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <section
          key={`${item.label}:${item.value}`}
          className="rounded-2xl border border-ink-600 bg-ink-800/70 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.12)] sm:px-5 sm:py-5"
        >
          <p className="text-sm font-medium text-zinc-300">{item.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">{item.value}</p>
          {item.detail ? <p className="mt-3 text-xs leading-5 text-zinc-500">{item.detail}</p> : null}
        </section>
      ))}
    </div>
  );
}

export function DashboardTablePanel({
  children,
  className,
  title,
  detail,
  toolbar,
}: {
  children: ReactNode;
  className?: string;
  title: string;
  detail: string;
  toolbar?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/70 shadow-[0_16px_40px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      <div className="border-b border-ink-600 px-4 py-4 sm:px-5 sm:py-5 md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
          </div>
          {toolbar ? <div className="flex shrink-0 flex-wrap items-center gap-3">{toolbar}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function DashboardEmpty({ children = "Belum ada data untuk ditampilkan." }: { children?: ReactNode }) {
  return (
    <div className="px-5 py-14 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-ink-600 bg-ink-800 text-gold-500">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-500">{children}</p>
    </div>
  );
}
