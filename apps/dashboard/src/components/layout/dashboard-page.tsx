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
        "scrollbar-thin relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_85%_-10%,rgba(212,175,55,0.06),transparent_28rem)] px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8",
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
    <header className="border-b border-ink-600 pb-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function DashboardPageMetrics({ items, className }: { items: DashboardMetric[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <section
          key={`${item.label}:${item.value}`}
          className="rounded-xl border border-ink-600 bg-ink-800 px-4 py-4 shadow-panel sm:px-5"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{item.value}</p>
          {item.detail ? <p className="mt-2 text-xs leading-5 text-zinc-500">{item.detail}</p> : null}
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
        "overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-panel",
        className,
      )}
    >
      <div className="border-b border-ink-600 px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
          </div>
          {toolbar ? <div className="flex shrink-0 flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function DashboardEmpty({ children = "Belum ada data untuk ditampilkan." }: { children?: ReactNode }) {
  return (
    <div className="px-5 py-14 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-ink-600 bg-ink-900 text-gold-500">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-500">{children}</p>
    </div>
  );
}
