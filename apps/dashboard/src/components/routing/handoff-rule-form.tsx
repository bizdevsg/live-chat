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

interface HandoffRule {
  id: string;
  reason: string;
  priority: string;
  isActive: boolean;
  targetTeamId: string | null;
}

type HandoffFormState = {
  reason: string;
  priority: string;
  targetTeamId: string;
  isActive: boolean;
};

const DEFAULT_HANDOFF_FORM: HandoffFormState = {
  reason: "",
  priority: "NORMAL",
  targetTeamId: "",
  isActive: true,
};

export function HandoffRuleForm({ siteId, ruleId }: { siteId: string; ruleId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<HandoffFormState>(DEFAULT_HANDOFF_FORM);
  const [hydrated, setHydrated] = useState(!ruleId);
  const backHref = siteId ? `/routing?siteId=${encodeURIComponent(siteId)}` : "/routing";
  const siteSuffix = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";

  const teamsQuery = useQuery({ queryKey: ["routing-teams"], queryFn: () => apiClient.get<TeamOption[]>("/api/v1/admin/routing-teams") });
  const rulesQuery = useQuery({
    queryKey: ["handoff-rules", siteId],
    enabled: !!ruleId && !!siteId,
    queryFn: () => apiClient.get<HandoffRule[]>(`/api/v1/admin/handoff-rules${siteSuffix}`),
  });
  const rule = ruleId ? rulesQuery.data?.find((item) => item.id === ruleId) : undefined;

  useEffect(() => {
    if (rule && !hydrated) {
      setForm({
        reason: rule.reason,
        priority: rule.priority,
        targetTeamId: rule.targetTeamId ?? "",
        isActive: rule.isActive,
      });
      setHydrated(true);
    }
  }, [rule, hydrated]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        reason: form.reason,
        priority: form.priority,
        targetTeamId: form.targetTeamId || undefined,
        isActive: form.isActive,
      };
      return ruleId
        ? apiClient.put(`/api/v1/admin/handoff-rules/${ruleId}`, payload)
        : apiClient.post(`/api/v1/admin/handoff-rules${siteSuffix}`, payload);
    },
    onSuccess: () => {
      toast.push(ruleId ? "Handoff rule diperbarui." : "Handoff rule dibuat.", "success");
      queryClient.invalidateQueries({ queryKey: ["routing-rules", siteId] });
      queryClient.invalidateQueries({ queryKey: ["handoff-rules", siteId] });
      router.push(backHref);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menyimpan handoff rule.", "error"),
  });

  const loading = !!ruleId && rulesQuery.isLoading;
  const missing = !!ruleId && !loading && !rule;

  return (
    <FormPage
      topbarTitle={ruleId ? "Edit Handoff Rule" : "Handoff Rule Baru"}
      title={ruleId ? (rule ? `Edit ${rule.reason}` : "Edit handoff rule") : "Handoff rule baru"}
      description="Tentukan kapan percakapan dieskalasi dari AI atau queue ke tim tujuan."
      backHref={backHref}
      backLabel="Kembali ke Routing Rules"
    >
      {loading ? (
        <FormNotice>Memuat handoff rule…</FormNotice>
      ) : missing || !siteId ? (
        <FormNotice>Handoff rule tidak ditemukan.</FormNotice>
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
              <Label htmlFor="handoff-reason">Alasan</Label>
              <Input
                id="handoff-reason"
                required
                placeholder="contoh: customer_meminta_agent"
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="handoff-priority">Prioritas</Label>
                <Select id="handoff-priority" value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}>
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="handoff-team">Target Team</Label>
                <Select id="handoff-team" value={form.targetTeamId} onChange={(e) => setForm((prev) => ({ ...prev, targetTeamId: e.target.value }))}>
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
