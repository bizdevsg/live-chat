"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-gold-500 text-ink-900 hover:bg-gold-600 focus-visible:ring-gold-500",
  secondary: "bg-ink-700 text-zinc-100 hover:bg-ink-600 border border-ink-600 focus-visible:ring-zinc-500",
  ghost: "bg-transparent text-zinc-300 hover:bg-ink-700 focus-visible:ring-zinc-500",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
