"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
}

interface ToastContextValue {
  push: (message: string, tone?: Toast["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm shadow-lg",
                  t.tone === "success" && "border-emerald-600 bg-emerald-950 text-emerald-300",
                  t.tone === "error" && "border-red-600 bg-red-950 text-red-300",
                  t.tone === "info" && "border-ink-600 bg-ink-800 text-zinc-200",
                )}
              >
                {t.message}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
