"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface AiRun {
  id: string;
  conversationId: string;
  purpose: string;
  provider: string;
  model: string;
  status: string;
  confidence: number | null;
  intent: string | null;
  latencyMs: number | null;
  handoffRequired: boolean | null;
  createdAt: string;
}

interface AiRunDetail extends AiRun {
  errorMessage: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  requestId: string | null;
  handoffReason: string | null;
  handoffSource: string | null;
  handoffEventType: string | null;
  handoffEventAt: string | null;
  conversation: {
    status: string;
    handlerType: string;
    handoffReason: string | null;
  };
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-sm text-zinc-200">{value}</div>
    </div>
  );
}

export default function AiRunsPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["ai-runs"], queryFn: () => apiClient.get<{ items: AiRun[] }>("/api/v1/ai/runs") });
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
  const handoffs = handoffsQuery.data?.items ?? [];
  const detail = detailQuery.data;
  const handoffCount = runs.filter((run) => run.handoffRequired).length;
  const averageLatency =
    runs.filter((run) => run.latencyMs != null).reduce((total, run) => total + (run.latencyMs ?? 0), 0) /
    Math.max(runs.filter((run) => run.latencyMs != null).length, 1);
  const averageConfidence =
    runs.filter((run) => run.confidence != null).reduce((total, run) => total + (run.confidence ?? 0), 0) /
    Math.max(runs.filter((run) => run.confidence != null).length, 1);

  return (
    <>
      <Topbar title="AI Runs" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="AI runs"
            description="Jejak eksekusi AI ditata ulang untuk membantu tim membaca performa model, kecepatan respons, dan kebutuhan handoff manusia dengan lebih jelas."
          />
          <DashboardPageMetrics
            items={[
              { label: "Run tercatat", value: String(runs.length), detail: "Semua eksekusi AI yang tersedia pada log saat ini." },
              { label: "Handoff", value: String(handoffCount), detail: "Run yang menandakan kebutuhan eskalasi ke manusia." },
              { label: "Rata-rata latensi", value: Number.isFinite(averageLatency) ? `${Math.round(averageLatency)} ms` : "-", detail: "Performa respons model di seluruh run yang punya data latensi." },
              { label: "Confidence rata-rata", value: Number.isFinite(averageConfidence) ? `${Math.round(averageConfidence * 100)}%` : "-", detail: "Indikasi keyakinan model terhadap hasil intent atau keputusan." },
            ]}
          />
          <DashboardTablePanel title="Execution timeline" detail={`${runs.length} run AI tersedia untuk ditinjau.`}>
          <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              <tr>
                <th className="px-5 py-4">Waktu</th>
                <th className="px-5 py-4">Tujuan</th>
                <th className="px-5 py-4">Model</th>
                <th className="px-5 py-4">Intent</th>
                <th className="px-5 py-4">Confidence</th>
                <th className="px-5 py-4">Latensi</th>
                <th className="px-5 py-4">Handoff</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/80">
              {runs.map((run) => (
                <tr key={run.id} className="transition-colors hover:bg-ink-700/35">
                  <td className="px-5 py-4 text-zinc-500">{new Date(run.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-zinc-100">{run.purpose}</div>
                    <div className="mt-1 text-xs text-zinc-500">{run.provider}</div>
                  </td>
                  <td className="px-5 py-4 text-zinc-400">{run.model}</td>
                  <td className="px-5 py-4 text-zinc-400">{run.intent ?? "-"}</td>
                  <td className="px-5 py-4 text-zinc-400">{run.confidence != null ? `${Math.round(run.confidence * 100)}%` : "-"}</td>
                  <td className="px-5 py-4 text-zinc-400">{run.latencyMs ? `${run.latencyMs} ms` : "-"}</td>
                  <td className="px-5 py-4">{run.handoffRequired ? <Badge tone="amber">Handoff</Badge> : <span className="text-zinc-600">-</span>}</td>
                  <td className="px-5 py-4 text-right">
                    <Button variant="secondary" size="sm" onClick={() => setSelectedRunId(run.id)}>
                      Detail
                    </Button>
                  </td>
                </tr>
              ))}
              {!query.isLoading && runs.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <DashboardEmpty>Belum ada AI run yang tercatat.</DashboardEmpty>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </DashboardTablePanel>

        <DashboardTablePanel
          title="Handoff timeline"
          detail="Sumber pemicu handoff dibedakan antara tombol user, keputusan AI, rule sistem, dan fallback error."
        >
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                <tr>
                  <th className="px-5 py-4">Waktu</th>
                  <th className="px-5 py-4">Conversation</th>
                  <th className="px-5 py-4">Sumber request</th>
                  <th className="px-5 py-4">Alasan</th>
                  <th className="px-5 py-4">Hasil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-600/80">
                {handoffs.map((handoff) => (
                  <tr key={handoff.id} className="transition-colors hover:bg-ink-700/35">
                    <td className="px-5 py-4 text-zinc-500">{new Date(handoff.createdAt).toLocaleString("id-ID")}</td>
                    <td className="px-5 py-4">
                      <div className="font-mono text-xs text-zinc-300">{handoff.conversationId}</div>
                      <div className="mt-1 text-xs text-zinc-500">{handoff.conversation.status}</div>
                    </td>
                    <td className="px-5 py-4 text-zinc-300">{HANDOFF_SOURCE_LABELS[handoff.source] ?? handoff.source}</td>
                    <td className="px-5 py-4">
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
                <DetailItem label="Conversation ID" value={detail.conversationId} />
                <DetailItem label="Waktu" value={new Date(detail.createdAt).toLocaleString("id-ID")} />
                <DetailItem label="Tujuan" value={detail.purpose} />
                <DetailItem label="Provider / Model" value={`${detail.provider} / ${detail.model}`} />
                <DetailItem label="Status" value={detail.status} />
                <DetailItem label="Intent" value={detail.intent ?? "-"} />
                <DetailItem label="Confidence" value={detail.confidence != null ? `${Math.round(detail.confidence * 100)}%` : "-"} />
                <DetailItem label="Latensi" value={detail.latencyMs != null ? `${detail.latencyMs} ms` : "-"} />
                <DetailItem label="Handler conversation" value={detail.conversation.handlerType} />
              </div>

              <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Alasan Handoff AI</h3>
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
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Error</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-red-100">{detail.errorMessage}</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
