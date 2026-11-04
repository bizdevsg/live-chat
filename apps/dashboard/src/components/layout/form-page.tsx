"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { Button } from "@/components/ui/button";

export function FormPage({
  topbarTitle,
  title,
  description,
  backHref,
  backLabel,
  children,
}: {
  topbarTitle: string;
  title: string;
  description?: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <>
      <Topbar title={topbarTitle} />
      <DashboardPage>
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <div>
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-gold-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {backLabel}
            </Link>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">{title}</h1>
            {description ? <p className="mt-1.5 text-sm leading-6 text-zinc-500">{description}</p> : null}
          </div>
          {children}
        </div>
      </DashboardPage>
    </>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ink-600 bg-ink-800 shadow-panel">
      <div className="border-b border-ink-600 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {description ? <p className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</p> : null}
      </div>
      <div className="space-y-4 px-5 py-5">{children}</div>
    </section>
  );
}

export function FormActions({
  cancelHref,
  submitLabel,
  pending,
  disabled,
}: {
  cancelHref: string;
  submitLabel: string;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Link href={cancelHref}>
        <Button type="button" variant="secondary">
          Batal
        </Button>
      </Link>
      <Button type="submit" disabled={pending || disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-ink-600 bg-ink-800 px-5 py-10 text-center text-sm text-zinc-500">{children}</div>;
}
