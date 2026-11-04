"use client";

import { TEMPLATE_VARIABLES } from "@/lib/template-variables";

/** Clickable list of the placeholders supported in templates; clicking one appends it to the text. */
export function TemplateVariablesHint({ onInsert }: { onInsert: (placeholder: string) => void }) {
  return (
    <div className="mt-2 rounded-lg border border-ink-600 bg-ink-900/60 p-3">
      <p className="text-xs font-medium text-zinc-300">Variabel otomatis</p>
      <p className="mt-0.5 text-xs text-zinc-500">Diganti saat agent memakai template. Klik untuk menambahkan ke isi.</p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {TEMPLATE_VARIABLES.map((variable) => (
          <li key={variable.key}>
            <button
              type="button"
              onClick={() => onInsert(`{{${variable.key}}}`)}
              title={`Contoh: ${variable.example}`}
              className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-ink-700"
            >
              <code className="shrink-0 rounded bg-ink-700 px-1.5 py-0.5 text-[11px] text-gold-300 group-hover:bg-ink-600">{`{{${variable.key}}}`}</code>
              <span className="text-[11px] leading-4 text-zinc-500">{variable.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
