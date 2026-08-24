"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
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

type RoutingFormState = {
  name: string;
  priority: number;
  strategy: string;
  targetTeamId: string;
  intent: string;
  isActive: boolean;
};

type HandoffFormState = {
  reason: string;
  priority: string;
  targetTeamId: string;
  isActive: boolean;
};

const DEFAULT_ROUTING_FORM: RoutingFormState = {
  name: "",
  priority: 0,
  strategy: "ROUND_ROBIN",
  targetTeamId: "",
  intent: "",
  isActive: true,
};

const DEFAULT_HANDOFF_FORM: HandoffFormState = {
  reason: "",
  priority: "NORMAL",
  targetTeamId: "",
  isActive: true,
};

export default function RoutingPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [routingOpen, setRoutingOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [editingRouting, setEditingRouting] = useState<RoutingRule | null>(null);
  const [editingHandoff, setEditingHandoff] = useState<HandoffRule | null>(null);
  const [deleting, setDeleting] = useState<{ type: "routing" | "handoff"; id: string; label: string } | null>(null);
  const [routingForm, setRoutingForm] = useState<RoutingFormState>(DEFAULT_ROUTING_FORM);
  const [handoffForm, setHandoffForm] = useState<HandoffFormState>(DEFAULT_HANDOFF_FORM);

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

  const saveRouting = useMutation({
    mutationFn: () => {
      const payload = {
        name: routingForm.name,
        priority: routingForm.priority,
        strategy: routingForm.strategy,
        targetTeamId: routingForm.targetTeamId || undefined,
        conditions: routingForm.intent.trim() ? { intent: routingForm.intent.trim() } : {},
        isActive: routingForm.isActive,
      };
      return editingRouting
        ? apiClient.put(`/api/v1/admin/routing-rules/${editingRouting.id}`, payload)
        : apiClient.post(`/api/v1/admin/routing-rules${siteSuffix}`, payload);
    },
    onSuccess: () => {
      toast.push(editingRouting ? "Routing rule diperbarui." : "Routing rule dibuat.", "success");
      invalidate();
      setRoutingOpen(false);
      setEditingRouting(null);
      setRoutingForm(DEFAULT_ROUTING_FORM);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menyimpan routing rule.", "error"),
  });

  const saveHandoff = useMutation({
    mutationFn: () => {
      const payload = {
        reason: handoffForm.reason,
        priority: handoffForm.priority,
        targetTeamId: handoffForm.targetTeamId || undefined,
        isActive: handoffForm.isActive,
      };
      return editingHandoff
        ? apiClient.put(`/api/v1/admin/handoff-rules/${editingHandoff.id}`, payload)
        : apiClient.post(`/api/v1/admin/handoff-rules${siteSuffix}`, payload);
    },
    onSuccess: () => {
      toast.push(editingHandoff ? "Handoff rule diperbarui." : "Handoff rule dibuat.", "success");
      invalidate();
      setHandoffOpen(false);
      setEditingHandoff(null);
      setHandoffForm(DEFAULT_HANDOFF_FORM);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menyimpan handoff rule.", "error"),
  });

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
            description="Control room routing diperbarui untuk memisahkan pemilihan site, distribusi assignment, dan logika handoff dalam satu alur yang lebih mudah dipindai."
            actions={
              <div className="flex gap-2">
                <Button onClick={() => setRoutingOpen(true)}>+ Routing Rule</Button>
                <Button variant="secondary" onClick={() => setHandoffOpen(true)}>
                  + Handoff Rule
                </Button>
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
            detail="Semua rule pada halaman ini mengikuti site yang dipilih di bawah. Ganti site untuk melihat konfigurasi yang berbeda."
            toolbar={
              <div className="w-full">
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
            <div className="px-5 py-4 text-sm text-zinc-400 md:px-6">
              {selectedSite
                ? `Konfigurasi yang ditampilkan saat ini berlaku untuk ${selectedSite.name} (${selectedSite.siteKey}).`
                : "Memuat pilihan site..."}
            </div>
          </DashboardTablePanel>

          <DashboardTablePanel title="Routing rules" detail="Aturan distribusi inbound conversation ke team tujuan untuk site yang sedang dipilih.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  <tr>
                    <th className="px-5 py-4">Nama</th>
                    <th className="px-5 py-4">Intent</th>
                    <th className="px-5 py-4">Strategi</th>
                    <th className="px-5 py-4">Prioritas</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/80">
                  {routingRules.map((rule) => (
                    <tr key={rule.id} className="transition-colors hover:bg-ink-700/35">
                      <td className="px-5 py-4 font-medium text-zinc-100">{rule.name}</td>
                      <td className="px-5 py-4 text-zinc-400">{rule.conditions?.intent?.trim() || "-"}</td>
                      <td className="px-5 py-4 text-zinc-400">{rule.strategy}</td>
                      <td className="px-5 py-4 text-zinc-400">{rule.priority}</td>
                      <td className="px-5 py-4">
                        <Badge tone={rule.isActive ? "green" : "neutral"}>{rule.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingRouting(rule);
                              setRoutingForm({
                                name: rule.name,
                                priority: rule.priority,
                                strategy: rule.strategy,
                                targetTeamId: rule.targetTeamId ?? "",
                                intent: rule.conditions?.intent ?? "",
                                isActive: rule.isActive,
                              });
                              setRoutingOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setDeleting({ type: "routing", id: rule.id, label: rule.name })}>
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
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  <tr>
                    <th className="px-5 py-4">Alasan</th>
                    <th className="px-5 py-4">Prioritas</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/80">
                  {handoffRules.map((rule) => (
                    <tr key={rule.id} className="transition-colors hover:bg-ink-700/35">
                      <td className="px-5 py-4 font-medium text-zinc-100">{rule.reason}</td>
                      <td className="px-5 py-4 text-zinc-400">{rule.priority}</td>
                      <td className="px-5 py-4">
                        <Badge tone={rule.isActive ? "green" : "neutral"}>{rule.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingHandoff(rule);
                              setHandoffForm({
                                reason: rule.reason,
                                priority: rule.priority,
                                targetTeamId: rule.targetTeamId ?? "",
                                isActive: rule.isActive,
                              });
                              setHandoffOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setDeleting({ type: "handoff", id: rule.id, label: rule.reason })}>
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

      <Modal
        open={routingOpen}
        title={editingRouting ? "Edit Routing Rule" : "Routing Rule Baru"}
        onClose={() => {
          setRoutingOpen(false);
          setEditingRouting(null);
          setRoutingForm(DEFAULT_ROUTING_FORM);
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveRouting.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="routing-name">Nama</Label>
            <Input id="routing-name" required value={routingForm.name} onChange={(e) => setRoutingForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="routing-priority">Prioritas</Label>
              <Input
                id="routing-priority"
                type="number"
                value={routingForm.priority}
                onChange={(e) => setRoutingForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label htmlFor="routing-strategy">Strategi</Label>
              <Select id="routing-strategy" value={routingForm.strategy} onChange={(e) => setRoutingForm((prev) => ({ ...prev, strategy: e.target.value }))}>
                <option value="ROUND_ROBIN">ROUND_ROBIN</option>
                <option value="LEAST_ACTIVE">LEAST_ACTIVE</option>
                <option value="MANUAL">MANUAL</option>
                <option value="SKILL_BASED">SKILL_BASED</option>
                <option value="PRIORITY_BASED">PRIORITY_BASED</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="routing-intent">Intent Condition</Label>
            <Input
              id="routing-intent"
              placeholder="contoh: harga_emas"
              value={routingForm.intent}
              onChange={(e) => setRoutingForm((prev) => ({ ...prev, intent: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="routing-team">Target Team</Label>
            <Select id="routing-team" value={routingForm.targetTeamId} onChange={(e) => setRoutingForm((prev) => ({ ...prev, targetTeamId: e.target.value }))}>
              <option value="">Tidak ditentukan</option>
              {teamsQuery.data?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={routingForm.isActive}
              onChange={(e) => setRoutingForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 rounded accent-gold-500"
            />
            Rule aktif
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={saveRouting.isPending}>
              {editingRouting ? "Simpan Perubahan" : "Buat Rule"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={handoffOpen}
        title={editingHandoff ? "Edit Handoff Rule" : "Handoff Rule Baru"}
        onClose={() => {
          setHandoffOpen(false);
          setEditingHandoff(null);
          setHandoffForm(DEFAULT_HANDOFF_FORM);
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveHandoff.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="handoff-reason">Alasan</Label>
            <Input
              id="handoff-reason"
              required
              placeholder="contoh: customer_meminta_agent"
              value={handoffForm.reason}
              onChange={(e) => setHandoffForm((prev) => ({ ...prev, reason: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="handoff-priority">Prioritas</Label>
              <Select id="handoff-priority" value={handoffForm.priority} onChange={(e) => setHandoffForm((prev) => ({ ...prev, priority: e.target.value }))}>
                <option value="LOW">LOW</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="handoff-team">Target Team</Label>
              <Select id="handoff-team" value={handoffForm.targetTeamId} onChange={(e) => setHandoffForm((prev) => ({ ...prev, targetTeamId: e.target.value }))}>
                <option value="">Tidak ditentukan</option>
                {teamsQuery.data?.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={handoffForm.isActive}
              onChange={(e) => setHandoffForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 rounded accent-gold-500"
            />
            Rule aktif
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={saveHandoff.isPending}>
              {editingHandoff ? "Simpan Perubahan" : "Buat Rule"}
            </Button>
          </div>
        </form>
      </Modal>

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
