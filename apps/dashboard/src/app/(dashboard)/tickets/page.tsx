"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "amber"> = {
  OPEN: "amber",
  IN_PROGRESS: "gold",
  RESOLVED: "green",
  CLOSED: "neutral",
  REOPENED: "red",
};

export default function TicketsPage() {
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["tickets", status],
    queryFn: () => apiClient.get<{ items: Ticket[]; total: number }>(`/api/v1/tickets${status ? `?status=${status}` : ""}`),
  });

  return (
    <>
      <Topbar title="Tickets" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex justify-end">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
            <option value="">Semua status</option>
            {["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_INTERNAL", "RESOLVED", "CLOSED", "REOPENED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nomor</th>
                <th className="px-4 py-3">Subjek</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Prioritas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((t) => (
                <tr key={t.id} className="border-t border-ink-700 hover:bg-ink-700/40">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="text-gold-500 hover:underline">
                      {t.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{t.subject}</td>
                  <td className="px-4 py-3 text-zinc-400">{t.category}</td>
                  <td className="px-4 py-3 text-zinc-400">{t.priority}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(t.createdAt).toLocaleDateString("id-ID")}</td>
                </tr>
              ))}
              {query.data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
                    Tidak ada ticket.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </main>
    </>
  );
}
