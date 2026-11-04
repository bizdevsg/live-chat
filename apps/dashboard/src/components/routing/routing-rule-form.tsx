"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Input, Label, Select } from "@/components/ui/input";
import { FormActions, FormNotice, FormPage, FormSection } from "@/components/layout/form-page";

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

type RoutingFormState = {
  name: string;
  priority: number;
  strategy: string;
  targetTeamId: string;
  intent: string;
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

export function RoutingRuleForm({ siteId, ruleId }: { siteId: string; ruleId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<RoutingFormState>(DEFAULT_ROUTING_FORM);
  const [hydrated, setHydrated] = useState(!ruleId);
  const backHref = siteId ? `/routing?siteId=${encodeURIComponent(siteId)}` : "/routing";
  const siteSuffix = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";

  const teamsQuery = useQuery({ queryKey: ["routing-teams"], queryFn: () => apiClient.get<TeamOption[]>("/api/v1/admin/routing-teams") });
  const rulesQuery = useQuery({
    queryKey: ["routing-rules", siteId],
    enabled: !!ruleId && !!siteId,
    queryFn: () => apiClient.get<RoutingRule[]>(`/api/v1/admin/routing-rules${siteSuffix}`),
  });
  const rule = ruleId ? rulesQuery.data?.find((item) => item.id === ruleId) : undefined;

  useEffect(() => {
    if (rule && !hydrated) {
      setForm({
        name: rule.name,
        priority: rule.priority,
        strategy: rule.strategy,
        targetTeamId: rule.targetTeamId ?? "",
        intent: rule.conditions?.intent ?? "",
        isActive: rule.isActive,
      });
      setHydrated(true);
    }
  }, [rule, hydrated]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        priority: form.priority,
        strategy: form.strategy,
        targetTeamId: form.targetTeamId || undefined,
        conditions: form.intent.trim() ? { intent: form.intent.trim() } : {},
        isActive: form.isActive,
      };
      return ruleId
        ? apiClient.put(`/api/v1/admin/routing-rules/${ruleId}`, payload)
        : apiClient.post(`/api/v1/admin/routing-rules${siteSuffix}`, payload);
    },
    onSuccess: () => {
      toast.push(ruleId ? "Routing rule diperbarui." : "Routing rule dibuat.", "success");
      queryClient.invalidateQueries({ queryKey: ["routing-rules", siteId] });
      queryClient.invalidateQueries({ queryKey: ["handoff-rules", siteId] });
      router.push(backHref);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menyimpan routing rule.", "error"),
  });

  const loading = !!ruleId && rulesQuery.isLoading;
  const missing = !!ruleId && !loading && !rule;

  return (
    <FormPage
      topbarTitle={ruleId ? "Edit Routing Rule" : "Routing Rule Baru"}
      title={ruleId ? (rule ? `Edit ${rule.name}` : "Edit routing rule") : "Routing rule baru"}
      description="Tentukan bagaimana percakapan masuk didistribusikan ke tim tujuan."
      backHref={backHref}
      backLabel="Kembali ke Routing Rules"
    >
      {loading ? (
        <FormNotice>Memuat routing rule…</FormNotice>
      ) : missing || !siteId ? (
        <FormNotice>Routing rule tidak ditemukan.</FormNotice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-6"
        >
          <FormSection title="Rule">
            <div>
              <Label htmlFor="routing-name">Nama</Label>
              <Input id="routing-name" required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="routing-priority">Prioritas</Label>
                <Input
                  id="routing-priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="routing-strategy">Strategi</Label>
                <Select id="routing-strategy" value={form.strategy} onChange={(e) => setForm((prev) => ({ ...prev, strategy: e.target.value }))}>
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
                value={form.intent}
                onChange={(e) => setForm((prev) => ({ ...prev, intent: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="routing-team">Target Team</Label>
              <Select id="routing-team" value={form.targetTeamId} onChange={(e) => setForm((prev) => ({ ...prev, targetTeamId: e.target.value }))}>
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
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 rounded accent-gold-500"
              />
              Rule aktif
            </label>
          </FormSection>
          <FormActions cancelHref={backHref} submitLabel={ruleId ? "Simpan Perubahan" : "Buat Rule"} pending={save.isPending} />
        </form>
      )}
    </FormPage>
  );
}
