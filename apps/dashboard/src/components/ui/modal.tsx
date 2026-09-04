"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { Button } from "./button";

export function Modal({
  open,
  title,
  children,
  onClose,
  panelClassName,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  panelClassName?: string;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div
        className={cn(
          "w-full rounded-xl border border-ink-600 bg-ink-800 shadow-xl",
          panelClassName ?? "max-w-md p-5",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3 px-5 pt-5">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="text-zinc-400 hover:text-zinc-200">
            x
          </button>
        </div>
        <div className={panelClassName ? "" : "px-5 pb-5"}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Konfirmasi",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-zinc-400">{description}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
