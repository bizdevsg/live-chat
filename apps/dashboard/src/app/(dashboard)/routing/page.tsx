"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ui/modal";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface SiteOption {
  id: string;
  name: string;
  siteKey: string;
}

interface TeamOption {
  id: string;
  name: string;
}

interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  strategy: string;
  isActive: boolean;
  targetTeamId: string | null;
  conditions?: { intent?: string } | null;
}

interface HandoffRule {
  id: string;
  reason: string;
  priority: string;
  isActive: boolean;
  targetTeamId: string | null;
}

function RoutingPageContent() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const initialSiteId = useSearchParams().get("siteId") ?? "";
  const [selectedSiteId, setSelectedSiteId] = useState(initialSiteId);
  const [deleting, setDeleting] = useState<{ type: "routing" | "handoff"; id: string; label: string } | null>(null);

  const sitesQuery = useQuery({ queryKey: ["routing-sites"], queryFn: () => apiClient.get<SiteOption[]>("/api/v1/admin/sites") });
  const teamsQuery = useQuery({ queryKey: ["routing-teams"], queryFn: () => apiClient.get<TeamOption[]>("/api/v1/admin/routing-teams") });

  useEffect(() => {
    if (!selectedSiteId && sitesQuery.data?.[0]?.id) {
      setSelectedSiteId(sitesQuery.data[0].id);
    }
  }, [selectedSiteId, sitesQuery.data]);

  const siteSuffix = selectedSiteId ? `?siteId=${encodeURIComponent(selectedSiteId)}` : "";

  const routing = useQuery({
    queryKey: ["routing-rules", selectedSiteId],
    enabled: !!selectedSiteId,
    queryFn: () => apiClient.get<RoutingRule[]>(`/api/v1/admin/routing-rules${siteSuffix}`),
  });

  const handoff = useQuery({
    queryKey: ["handoff-rules", selectedSiteId],
    enabled: !!selectedSiteId,
    queryFn: () => apiClient.get<HandoffRule[]>(`/api/v1/admin/handoff-rules${siteSuffix}`),
  });

  const routingRules = routing.data ?? [];
  const handoffRules = handoff.data ?? [];
  const activeRouting = routingRules.filter((rule) => rule.isActive).length;
  const activeHandoff = handoffRules.filter((rule) => rule.isActive).length;
  const selectedSite = sitesQuery.data?.find((site) => site.id === selectedSiteId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["routing-rules", selectedSiteId] });
    queryClient.invalidateQueries({ queryKey: ["handoff-rules", selectedSiteId] });
  };

  const removeRule = useMutation({
    mutationFn: ({ type, id }: { type: "routing" | "handoff"; id: string }) =>
      apiClient.delete(type === "routing" ? `/api/v1/admin/routing-rules/${id}` : `/api/v1/admin/handoff-rules/${id}`),
    onSuccess: () => {
      toast.push("Rule berhasil dihapus.", "success");
      invalidate();
      setDeleting(null);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus rule.", "error"),
  });

  return (
    <>
      <Topbar title="Routing Rules" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Routing rules"
            description="Atur pemilihan site, distribusi assignment, dan logika handoff dalam satu tempat."
            actions={
              <div className="flex gap-2">
                <Link href={`/routing/rules/new${siteSuffix}`}>
                  <Button>+ Routing Rule</Button>
                </Link>
                <Link href={`/routing/handoff/new${siteSuffix}`}>
                  <Button variant="secondary">+ Handoff Rule</Button>
                </Link>
              </div>
            }
          />
          <DashboardPageMetrics
            items={[
              { label: "Site aktif", value: selectedSite ? selectedSite.name : "-", detail: selectedSite ? selectedSite.siteKey : "Pilih site untuk memuat aturan." },
              { label: "Routing rule", value: String(routingRules.length), detail: `${activeRouting} rule aktif untuk site ini.` },
              { label: "Handoff rule", value: String(handoffRules.length), detail: `${activeHandoff} rule aktif untuk site ini.` },
              { label: "Team target", value: String(teamsQuery.data?.length ?? 0), detail: "Pilihan tim yang tersedia untuk assignment atau handoff." },
            ]}
          />
          <DashboardTablePanel
            title="Site scope"
            detail="Semua rule pada halaman ini mengikuti site yang dipilih. Ganti site untuk melihat konfigurasi yang berbeda."
            toolbar={
              <div className="w-full min-w-[16rem]">
                <Label htmlFor="siteId">Site</Label>
                <Select id="siteId" value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
                  {sitesQuery.data?.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} ({site.siteKey})
                    </option>
                  ))}
                </Select>
              </div>
            }
          >
            <div className="px-4 py-3.5 text-sm text-zinc-400 sm:px-5">
              {selectedSite
                ? `Konfigurasi yang ditampilkan saat ini berlaku untuk ${selectedSite.name} (${selectedSite.siteKey}).`
                : "Memuat pilihan site..."}
            </div>
          </DashboardTablePanel>

          <DashboardTablePanel title="Routing rules" detail="Aturan distribusi inbound conversation ke team tujuan untuk site yang sedang dipilih.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="text-left">
                  <tr>
                    <th className="px-5 py-3">Nama</th>
                    <th className="px-5 py-3">Intent</th>
                    <th className="px-5 py-3">Strategi</th>
                    <th className="px-5 py-3">Prioritas</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/80">
                  {routingRules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-5 py-3.5 font-medium text-zinc-100">{rule.name}</td>
                      <td className="px-5 py-3.5 text-zinc-400">{rule.conditions?.intent?.trim() || "-"}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-zinc-400">{rule.strategy}</td>
                      <td className="px-5 py-3.5 text-zinc-400">{rule.priority}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={rule.isActive ? "green" : "neutral"}>{rule.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1.5">
                          <Link href={`/routing/rules/${rule.id}/edit${siteSuffix}`}>
                            <Button size="sm" variant="ghost">
                              Edit
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => setDeleting({ type: "routing", id: rule.id, label: rule.name })}
                          >
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!routing.isLoading && routingRules.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <DashboardEmpty>Belum ada routing rule untuk site ini.</DashboardEmpty>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DashboardTablePanel>

          <DashboardTablePanel title="Handoff rules" detail="Aturan eskalasi conversation dari AI atau queue ke tim tujuan berdasarkan alasan dan prioritas.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left">
                  <tr>
                    <th className="px-5 py-3">Alasan</th>
                    <th className="px-5 py-3">Prioritas</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/80">
                  {handoffRules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="px-5 py-3.5 font-medium text-zinc-100">{rule.reason}</td>
                      <td className="px-5 py-3.5 text-zinc-400">{rule.priority}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={rule.isActive ? "green" : "neutral"}>{rule.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1.5">
                          <Link href={`/routing/handoff/${rule.id}/edit${siteSuffix}`}>
                            <Button size="sm" variant="ghost">
                              Edit
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => setDeleting({ type: "handoff", id: rule.id, label: rule.reason })}
                          >
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!handoff.isLoading && handoffRules.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <DashboardEmpty>Belum ada handoff rule untuk site ini.</DashboardEmpty>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DashboardTablePanel>
        </div>
      </DashboardPage>

      <ConfirmModal
        open={!!deleting}
        title="Hapus Rule"
        description={`Rule "${deleting?.label ?? ""}" akan dihapus permanen.`}
        confirmLabel={removeRule.isPending ? "Menghapus..." : "Hapus"}
        danger
        onConfirm={() => {
          if (deleting) removeRule.mutate({ type: deleting.type, id: deleting.id });
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

export default function RoutingPage() {
  return (
    <Suspense fallback={null}>
      <RoutingPageContent />
    </Suspense>
  );
}
