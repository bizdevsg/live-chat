import type { HTMLAttributes } from "react";
import { cn } from "./cn";

const tones = {
  neutral: "bg-ink-700 text-zinc-300 ring-1 ring-inset ring-ink-600",
  gold: "bg-gold-500/10 text-gold-300 ring-1 ring-inset ring-gold-500/30",
  green: "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/25",
  red: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/25",
  blue: "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/25",
  amber: "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/25",
} as const;

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide", tones[tone], className)} {...props} />;
}
