"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import {
  DashboardEmpty,
  DashboardPage,
  DashboardPageHeader,
  DashboardPageMetrics,
  DashboardTablePanel,
} from "@/components/layout/dashboard-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  productInterest: string | null;
  syncStatus: string;
  syncError: string | null;
  createdAt: string;
}

const TONE: Record<string, "amber" | "green" | "red"> = { PENDING: "amber", SYNCED: "green", FAILED: "red" };

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ["leads"], queryFn: () => apiClient.get<Lead[]>("/api/v1/leads") });
  const leads = query.data ?? [];
  const syncedCount = leads.filter((lead) => lead.syncStatus === "SYNCED").length;
  const failedCount = leads.filter((lead) => lead.syncStatus === "FAILED").length;
  const pendingCount = leads.filter((lead) => lead.syncStatus === "PENDING").length;

  const retry = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/leads/${id}/retry`),
    onSuccess: () => {
      toast.push("Retry sinkronisasi lead dijadwalkan.", "success");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal retry.", "error"),
  });

  return (
    <>
      <Topbar title="Leads" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Leads"
            description="Tampilan lead diperbarui agar tim sales dan operasional bisa membaca kualitas pipeline dan masalah sinkronisasi CRM tanpa membuka detail satu per satu."
          />
          <DashboardPageMetrics
            items={[
              { label: "Total lead", value: String(leads.length), detail: "Semua lead yang sudah masuk ke sistem." },
              { label: "Synced", value: String(syncedCount), detail: "Lead yang sudah berhasil terkirim ke CRM." },
              { label: "Pending", value: String(pendingCount), detail: "Lead yang masih menunggu proses sinkronisasi." },
              { label: "Failed", value: String(failedCount), detail: "Lead yang perlu ditinjau atau di-retry." },
            ]}
          />
          <DashboardTablePanel title="Lead pipeline" detail={`${leads.length} lead tercatat dengan status sinkronisasi paling baru.`}>
            <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                <tr>
                  <th className="px-5 py-4">Nama</th>
                  <th className="px-5 py-4">Kontak</th>
                  <th className="px-5 py-4">Produk</th>
                  <th className="px-5 py-4">Sync CRM</th>
                  <th className="px-5 py-4">Dibuat</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-600/80">
                {leads.map((lead) => (
                  <tr key={lead.id} className="transition-colors hover:bg-ink-700/35">
                    <td className="px-5 py-4">
                      <div className="font-medium text-zinc-100">{lead.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">Lead {lead.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-5 py-4 text-zinc-400">{lead.email ?? lead.phone ?? "-"}</td>
                    <td className="px-5 py-4 text-zinc-400">{lead.productInterest ?? "-"}</td>
                    <td className="px-5 py-4">
                      <Badge tone={TONE[lead.syncStatus] ?? "amber"}>{lead.syncStatus}</Badge>
                    </td>
                    <td className="px-5 py-4 text-zinc-500">{new Date(lead.createdAt).toLocaleDateString("id-ID")}</td>
                    <td className="px-5 py-4">
                      {lead.syncStatus === "FAILED" ? (
                        <Button size="sm" variant="secondary" onClick={() => retry.mutate(lead.id)}>
                          Retry
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!query.isLoading && leads.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <DashboardEmpty>Belum ada lead.</DashboardEmpty>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
          </DashboardTablePanel>
        </div>
      </DashboardPage>
    </>
  );
}
