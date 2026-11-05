"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/components/ui/cn";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface AiRun {
  id: string;
  conversationId: string | null;
  source: "CHAT" | "KNOWLEDGE_TESTER" | "EXTENSION" | "KNOWLEDGE_REPROCESS";
  purpose: string;
  provider: string;
  model: string;
  status: string;
  confidence: number | null;
  intent: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  handoffRequired: boolean | null;
  estimatedCostUsd: number | null;
  createdAt: string;
}

interface AiRunMessage {
  id: string;
  role: "INPUT" | "OUTPUT";
  content: string;
}

interface AiRunToolCall {
  id: string;
  toolName: string;
  input: unknown;
  output: unknown;
  allowed: boolean;
  createdAt: string;
}

interface AiRunFeedback {
  id: string;
  agentId: string | null;
  helpful: boolean;
  used: boolean;
  edited: boolean;
  createdAt: string;
}

interface AiRunDetail extends AiRun {
  errorMessage: string | null;
  requestId: string | null;
  handoffReason: string | null;
  handoffSource: string | null;
  handoffEventType: string | null;
  handoffEventAt: string | null;
  conversation: {
    status: string;
    handlerType: string;
    handoffReason: string | null;
  } | null;
  messages: AiRunMessage[];
  toolCalls: AiRunToolCall[];
  feedback: AiRunFeedback[];
}

interface HandoffEvent {
  id: string;
  conversationId: string;
  eventType: string;
  reason: string;
  source: string;
  outcome: string | null;
  createdAt: string;
  conversation: {
    status: string;
    handlerType: string;
  };
}

const HANDOFF_REASON_LABELS: Record<string, string> = {
  CUSTOMER_REQUESTED_HUMAN: "Customer meminta atau menyetujui pengalihan ke agent",
  DEPOSIT_ISSUE: "Masalah deposit",
  WITHDRAWAL_ISSUE: "Masalah withdrawal",
  TRANSACTION_DISPUTE: "Perselisihan transaksi",
  LOGIN_ISSUE: "Masalah login",
  ACCOUNT_LOCKED: "Akun terkunci",
  PERSONAL_DATA_CHANGE: "Perubahan data pribadi",
  DOCUMENT_VERIFICATION: "Verifikasi dokumen",
  SENSITIVE_DATA_DETECTED: "Data sensitif terdeteksi",
  SUSPECTED_FRAUD: "Dugaan penipuan",
  SERIOUS_COMPLAINT: "Keluhan serius",
  LEGAL_THREAT: "Ancaman atau persoalan hukum",
  ANGRY_CUSTOMER: "Customer terdeteksi marah",
  AI_FAILED_TWICE: "Proses AI gagal dan dialihkan sebagai fallback",
  KNOWLEDGE_INSUFFICIENT: "Knowledge tidak cukup untuk menjawab",
  LOW_CONFIDENCE: "Confidence AI terlalu rendah",
  ACCOUNT_DATA_REQUIRED: "Membutuhkan data akun yang harus ditangani agent",
  PERSONAL_TRADING_DECISION: "Permintaan keputusan trading personal",
  BUY_SELL_REQUEST: "Permintaan eksekusi buy atau sell",
  PROFIT_GUARANTEE_REQUEST: "Permintaan jaminan profit",
  SECURITY_RISK: "Risiko keamanan akun",
  PROMPT_INJECTION_DETECTED: "Percobaan prompt injection terdeteksi",
  UNSPECIFIED: "Alasan spesifik tidak terekam",
};

const HANDOFF_EVENT_LABELS: Record<string, string> = {
  "handoff.requested": "Masuk antrean agent",
  "handoff.unavailable_no_agent": "Agent tidak tersedia, AI tetap menangani",
  "handoff.deferred_no_team": "Tidak ada tim tujuan, AI tetap menangani",
};

const HANDOFF_SOURCE_LABELS: Record<string, string> = {
  USER_BUTTON: "User — tombol Request Agent",
  AI_DECISION: "AI — keputusan berdasarkan percakapan",
  SYSTEM_RULE: "Sistem — rule handoff wajib",
  AI_ERROR_FALLBACK: "Sistem — fallback karena proses AI gagal",
  UNKNOWN: "Data lama — sumber belum tercatat",
};

const AI_RUN_SOURCE_LABELS: Record<AiRun["source"], string> = {
  CHAT: "Chat",
  KNOWLEDGE_TESTER: "Knowledge Tester",
  EXTENSION: "Extension",
  KNOWLEDGE_REPROCESS: "Knowledge Reprocess",
};

const AI_RUN_PURPOSE_LABELS: Record<string, string> = {
  CLASSIFY: "Klasifikasi intent",
  ANSWER: "Jawaban AI",
  SUMMARY: "Ringkasan",
  SUGGESTED_REPLY: "Saran balasan",
  EMBEDDING: "Embedding",
};

const AI_RUN_STATUS: Record<string, { label: string; tone: "green" | "red" | "amber" | "neutral" }> = {
  SUCCESS: { label: "Sukses", tone: "green" },
  ERROR: { label: "Error", tone: "red" },
  TIMEOUT: { label: "Timeout", tone: "amber" },
};

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "SUCCESS", label: "Sukses" },
  { value: "ERROR", label: "Error" },
  { value: "TIMEOUT", label: "Timeout" },
];

const PURPOSE_OPTIONS = [
  { value: "", label: "Semua tujuan" },
  { value: "CLASSIFY", label: "Klasifikasi intent" },
  { value: "ANSWER", label: "Jawaban AI" },
  { value: "SUMMARY", label: "Ringkasan" },
  { value: "SUGGESTED_REPLY", label: "Saran balasan" },
  { value: "EMBEDDING", label: "Embedding" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "Semua sumber" },
  { value: "CHAT", label: "Chat" },
  { value: "KNOWLEDGE_TESTER", label: "Knowledge Tester" },
  { value: "EXTENSION", label: "Extension" },
  { value: "KNOWLEDGE_REPROCESS", label: "Knowledge Reprocess" },
];

const SELECT_CLASS =
  "h-9 rounded-lg border border-ink-600 bg-ink-800 px-2.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-gold-500";

function StatusBadge({ status }: { status: string }) {
  const cfg = AI_RUN_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

function confidenceTone(confidence: number | null) {
  if (confidence == null) return "text-zinc-500";
  if (confidence < 0.5) return "text-red-400";
  if (confidence < 0.75) return "text-amber-400";
  return "text-emerald-400";
}

/** Costs are often sub-cent; show enough precision to not round everything to "$0.00". */
function formatCostUsd(value: number | null) {
  if (value == null) return "-";
  if (value === 0) return "Gratis";
  return `$${value < 0.01 ? value.toFixed(6) : value.toFixed(4)}`;
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-sm text-zinc-200">{value}</div>
    </div>
  );
}

function DetailSection({ title, count, children, defaultOpen }: { title: string; count: number; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-ink-600 bg-ink-900/40" open={defaultOpen}>
      <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-200">
        {title} ({count})
        <span className="text-zinc-600 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-3 border-t border-ink-600 p-4">{children}</div>
    </details>
  );
}

export default function AiRunsPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [purposeFilter, setPurposeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const runsParams = new URLSearchParams({ page: String(page) });
  if (statusFilter) runsParams.set("status", statusFilter);
  if (purposeFilter) runsParams.set("purpose", purposeFilter);
  if (sourceFilter) runsParams.set("source", sourceFilter);

  const query = useQuery({
    queryKey: ["ai-runs", page, statusFilter, purposeFilter, sourceFilter],
    queryFn: () =>
      apiClient.get<{ items: AiRun[]; total: number; page: number; pageSize: number }>(`/api/v1/ai/runs?${runsParams.toString()}`),
  });
  const detailQuery = useQuery({
    queryKey: ["ai-run-detail", selectedRunId],
    queryFn: () => apiClient.get<AiRunDetail>(`/api/v1/ai/runs/${selectedRunId}`),
    enabled: Boolean(selectedRunId),
  });
  const handoffsQuery = useQuery({
    queryKey: ["ai-handoffs"],
    queryFn: () => apiClient.get<{ items: HandoffEvent[] }>("/api/v1/ai/handoffs"),
  });

  const runs = query.data?.items ?? [];
  const total = query.data?.total ?? runs.length;
  const pageSize = query.data?.pageSize ?? 30;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const handoffs = handoffsQuery.data?.items ?? [];
  const detail = detailQuery.data;

  const successRate = runs.length > 0 ? runs.filter((run) => run.status === "SUCCESS").length / runs.length : null;
  const handoffRate = runs.length > 0 ? runs.filter((run) => run.handoffRequired).length / runs.length : null;
  const runsWithCost = runs.filter((run) => run.estimatedCostUsd != null);
  const totalCost = runsWithCost.reduce((sum, run) => sum + (run.estimatedCostUsd ?? 0), 0);

  return (
    <>
      <Topbar title="AI Runs" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="AI runs"
            description="Jejak eksekusi AI: performa model, kecepatan respons, dan kebutuhan handoff ke manusia."
          />
          <DashboardPageMetrics
            items={[
              { label: "Run tercatat", value: String(total), detail: `${runs.length} ditampilkan pada halaman ini, dari total ${total} run.` },
              {
                label: "Tingkat sukses",
                value: successRate != null ? `${Math.round(successRate * 100)}%` : "-",
                tone: successRate != null && successRate < 0.9 ? "alert" : undefined,
                detail: "Proporsi run berstatus sukses pada halaman yang sedang ditampilkan.",
              },
              {
                label: "Handoff",
                value: handoffRate != null ? `${Math.round(handoffRate * 100)}%` : "-",
                tone: handoffRate != null && handoffRate > 0.3 ? "warn" : undefined,
                detail: "Proporsi run yang memicu eskalasi ke agent manusia.",
              },
              {
                label: "Estimasi biaya",
                value: runsWithCost.length > 0 ? formatCostUsd(totalCost) : "-",
                detail:
                  "Estimasi biaya API berdasarkan jumlah token dan harga model (bukan tagihan resmi). Run dengan model di luar daftar harga atau tanpa data token tidak dihitung. Rata-rata latensi tersedia per baris pada kolom Performa.",
              },
            ]}
          />
          <DashboardTablePanel
            title="Execution timeline"
            detail={`${total} run AI tersedia untuk ditinjau.`}
            toolbar={
              <>
                <select
                  aria-label="Filter status"
                  value={statusFilter}
                  onChange={(event) => updateFilter(setStatusFilter, event.target.value)}
                  className={SELECT_CLASS}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter tujuan"
                  value={purposeFilter}
                  onChange={(event) => updateFilter(setPurposeFilter, event.target.value)}
                  className={SELECT_CLASS}
                >
                  {PURPOSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter sumber"
                  value={sourceFilter}
                  onChange={(event) => updateFilter(setSourceFilter, event.target.value)}
                  className={SELECT_CLASS}
                >
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </>
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-5 py-3.5">Waktu</th>
                    <th className="px-5 py-3.5">Tujuan</th>
                    <th className="px-5 py-3.5">Sumber</th>
                    <th className="px-5 py-3.5">Model</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Intent</th>
                    <th className="px-5 py-3.5">Confidence</th>
                    <th className="px-5 py-3.5">Performa</th>
                    <th className="px-5 py-3.5">Handoff</th>
                    <th className="px-5 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/80">
                  {runs.map((run) => (
                    <tr key={run.id} className="transition-colors hover:bg-ink-700/35">
                      <td className="px-5 py-4 text-zinc-500">{new Date(run.createdAt).toLocaleString("id-ID")}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-zinc-100">{AI_RUN_PURPOSE_LABELS[run.purpose] ?? run.purpose}</div>
                        <div className="mt-1 text-xs text-zinc-500">{run.provider}</div>
                      </td>
                      <td className="px-5 py-4 text-zinc-400">{AI_RUN_SOURCE_LABELS[run.source] ?? run.source}</td>
                      <td className="px-5 py-4 text-zinc-400">{run.model}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-5 py-4 text-zinc-400">{run.intent ?? "-"}</td>
                      <td className={cn("px-5 py-4 font-medium", confidenceTone(run.confidence))}>
                        {run.confidence != null ? `${Math.round(run.confidence * 100)}%` : "-"}
                      </td>
                      <td className="px-5 py-4 text-zinc-400">
                        <div>{run.latencyMs != null ? `${run.latencyMs} ms` : "-"}</div>
                        <div className="mt-0.5 text-xs text-zinc-600">
                          {run.inputTokens != null || run.outputTokens != null
                            ? `${(run.inputTokens ?? 0) + (run.outputTokens ?? 0)} token`
                            : "-"}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-600">{formatCostUsd(run.estimatedCostUsd)}</div>
                      </td>
                      <td className="px-5 py-3.5">{run.handoffRequired ? <Badge tone="amber">Handoff</Badge> : <span className="text-zinc-600">-</span>}</td>
                      <td className="px-5 py-4 text-right">
                        <Button variant="secondary" size="sm" onClick={() => setSelectedRunId(run.id)}>
                          Detail
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!query.isLoading && runs.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <DashboardEmpty>Belum ada AI run yang cocok dengan filter ini.</DashboardEmpty>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-ink-600 px-5 py-3.5">
                <p className="text-xs text-zinc-500">
                  Halaman {page} dari {totalPages} &middot; {total} run total
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    Sebelumnya
                  </Button>
                  <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    Berikutnya
                  </Button>
                </div>
              </div>
            ) : null}
          </DashboardTablePanel>

          <DashboardTablePanel
            title="Handoff timeline"
            detail="Sumber pemicu handoff dibedakan antara tombol user, keputusan AI, rule sistem, dan fallback error."
          >
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-5 py-3.5">Waktu</th>
                    <th className="px-5 py-3.5">Conversation</th>
                    <th className="px-5 py-3.5">Sumber request</th>
                    <th className="px-5 py-3.5">Alasan</th>
                    <th className="px-5 py-3.5">Hasil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/80">
                  {handoffs.map((handoff) => (
                    <tr key={handoff.id} className="transition-colors hover:bg-ink-700/35">
                      <td className="px-5 py-4 text-zinc-500">{new Date(handoff.createdAt).toLocaleString("id-ID")}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-xs text-zinc-300">{handoff.conversationId}</div>
                        <div className="mt-1 text-xs text-zinc-500">{handoff.conversation.status}</div>
                      </td>
                      <td className="px-5 py-4 text-zinc-300">{HANDOFF_SOURCE_LABELS[handoff.source] ?? handoff.source}</td>
                      <td className="px-5 py-3.5">
                        <div className="text-zinc-300">{HANDOFF_REASON_LABELS[handoff.reason] ?? handoff.reason}</div>
                        <div className="mt-1 text-xs text-zinc-600">{handoff.reason}</div>
                      </td>
                      <td className="px-5 py-4 text-zinc-400">{HANDOFF_EVENT_LABELS[handoff.eventType] ?? handoff.eventType}</td>
                    </tr>
                  ))}
                  {!handoffsQuery.isLoading && handoffs.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <DashboardEmpty>Belum ada event handoff yang tercatat.</DashboardEmpty>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DashboardTablePanel>
        </div>
      </DashboardPage>
      <Modal
        open={Boolean(selectedRunId)}
        title="Detail AI Run"
        onClose={() => setSelectedRunId(null)}
        panelClassName="max-h-[85vh] max-w-2xl overflow-y-auto"
      >
        <div className="space-y-4 px-5 pb-5">
          {detailQuery.isLoading ? <p className="py-8 text-center text-sm text-zinc-500">Memuat detail AI run...</p> : null}
          {detailQuery.isError ? <p className="rounded-lg border border-red-800/60 bg-red-950/30 p-3 text-sm text-red-300">Detail AI run gagal dimuat.</p> : null}
          {detail ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="Run ID" value={detail.id} />
                <DetailItem label="Status" value={<StatusBadge status={detail.status} />} />
                <DetailItem label="Sumber" value={AI_RUN_SOURCE_LABELS[detail.source] ?? detail.source} />
                <DetailItem label="Conversation ID" value={detail.conversationId ?? "-"} />
                <DetailItem label="Waktu" value={new Date(detail.createdAt).toLocaleString("id-ID")} />
                <DetailItem label="Tujuan" value={AI_RUN_PURPOSE_LABELS[detail.purpose] ?? detail.purpose} />
                <DetailItem label="Provider / Model" value={`${detail.provider} / ${detail.model}`} />
                <DetailItem label="Intent" value={detail.intent ?? "-"} />
                <DetailItem
                  label="Confidence"
                  value={
                    detail.confidence != null ? (
                      <span className={confidenceTone(detail.confidence)}>{Math.round(detail.confidence * 100)}%</span>
                    ) : (
                      "-"
                    )
                  }
                />
                <DetailItem label="Latensi" value={detail.latencyMs != null ? `${detail.latencyMs} ms` : "-"} />
                <DetailItem label="Input token" value={detail.inputTokens?.toLocaleString("id-ID") ?? "-"} />
                <DetailItem label="Output token" value={detail.outputTokens?.toLocaleString("id-ID") ?? "-"} />
                <DetailItem
                  label="Total token"
                  value={
                    detail.inputTokens != null || detail.outputTokens != null
                      ? ((detail.inputTokens ?? 0) + (detail.outputTokens ?? 0)).toLocaleString("id-ID")
                      : "-"
                  }
                />
                <DetailItem label="Estimasi biaya" value={formatCostUsd(detail.estimatedCostUsd)} />
                <DetailItem label="Handler conversation" value={detail.conversation?.handlerType ?? "-"} />
              </div>

              <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300">Alasan Handoff AI</h3>
                  {detail.handoffRequired ? <Badge tone="amber">Handoff</Badge> : <Badge tone="neutral">Tidak handoff</Badge>}
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-200">
                  {detail.handoffRequired
                    ? HANDOFF_REASON_LABELS[detail.handoffReason ?? "UNSPECIFIED"] ?? detail.handoffReason
                    : "Run ini tidak memicu handoff ke agent."}
                </p>
                {detail.handoffReason ? <p className="mt-1 text-xs text-zinc-500">Kode: {detail.handoffReason}</p> : null}
                {detail.handoffSource ? (
                  <p className="mt-2 text-sm text-zinc-300">
                    Sumber request: {HANDOFF_SOURCE_LABELS[detail.handoffSource] ?? detail.handoffSource}
                  </p>
                ) : null}
                {detail.handoffEventType ? (
                  <p className="mt-2 text-xs text-zinc-400">
                    Hasil: {HANDOFF_EVENT_LABELS[detail.handoffEventType] ?? detail.handoffEventType}
                    {detail.handoffEventAt ? ` · ${new Date(detail.handoffEventAt).toLocaleString("id-ID")}` : ""}
                  </p>
                ) : null}
              </div>

              {detail.errorMessage ? (
                <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-red-300">Error</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-red-100">{detail.errorMessage}</p>
                </div>
              ) : null}

              {detail.messages.length > 0 ? (
                <DetailSection title="Percakapan" count={detail.messages.length} defaultOpen>
                  {detail.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-lg border p-3",
                        message.role === "INPUT" ? "border-blue-700/40 bg-blue-950/10" : "border-gold-700/40 bg-gold-950/10",
                      )}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {message.role === "INPUT" ? "Input (prompt)" : "Output (respons)"}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{message.content}</p>
                    </div>
                  ))}
                </DetailSection>
              ) : null}

              {detail.toolCalls.length > 0 ? (
                <DetailSection title="Tool calls" count={detail.toolCalls.length}>
                  {detail.toolCalls.map((toolCall) => (
                    <div key={toolCall.id} className="rounded-lg border border-ink-600 bg-ink-950/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-zinc-200">{toolCall.toolName}</span>
                        <Badge tone={toolCall.allowed ? "green" : "red"}>{toolCall.allowed ? "Diizinkan" : "Diblokir"}</Badge>
                      </div>
                      {toolCall.input != null ? (
                        <pre className="mt-2 overflow-x-auto rounded bg-ink-900 p-2 text-[11px] text-zinc-400">
                          {JSON.stringify(toolCall.input, null, 2)}
                        </pre>
                      ) : null}
                      {toolCall.output != null ? (
                        <pre className="mt-2 overflow-x-auto rounded bg-ink-900 p-2 text-[11px] text-zinc-400">
                          {JSON.stringify(toolCall.output, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </DetailSection>
              ) : null}

              {detail.feedback.length > 0 ? (
                <DetailSection title="Feedback agent" count={detail.feedback.length}>
                  <div className="divide-y divide-ink-600/60 rounded-lg border border-ink-600">
                    {detail.feedback.map((feedback) => (
                      <div key={feedback.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge tone={feedback.helpful ? "green" : "red"}>{feedback.helpful ? "Membantu" : "Tidak membantu"}</Badge>
                          {feedback.used ? <Badge tone="blue">Dipakai</Badge> : null}
                          {feedback.edited ? <Badge tone="amber">Diedit</Badge> : null}
                        </div>
                        <span className="text-xs text-zinc-500">{new Date(feedback.createdAt).toLocaleString("id-ID")}</span>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              ) : null}
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
