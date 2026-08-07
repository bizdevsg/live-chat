"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
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
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Sync CRM</th>
                <th className="px-4 py-3">Dibuat</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {query.data?.map((lead) => (
                <tr key={lead.id} className="border-t border-ink-700 hover:bg-ink-700/40">
                  <td className="px-4 py-3">{lead.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{lead.email ?? lead.phone ?? "-"}</td>
                  <td className="px-4 py-3 text-zinc-400">{lead.productInterest ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={TONE[lead.syncStatus] ?? "amber"}>{lead.syncStatus}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(lead.createdAt).toLocaleDateString("id-ID")}</td>
                  <td className="px-4 py-3">
                    {lead.syncStatus === "FAILED" && (
                      <Button size="sm" variant="secondary" onClick={() => retry.mutate(lead.id)}>
                        Retry
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {query.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-600">
                    Belum ada lead.
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
