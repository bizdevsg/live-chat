import type { HTMLAttributes } from "react";
import { cn } from "./cn";

const tones = {
  neutral: "bg-ink-700 text-zinc-300",
  gold: "bg-gold-500/20 text-gold-500",
  green: "bg-emerald-500/20 text-emerald-400",
  red: "bg-red-500/20 text-red-400",
  blue: "bg-blue-500/20 text-blue-400",
  amber: "bg-amber-500/20 text-amber-400",
} as const;

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)} {...props} />;
}
