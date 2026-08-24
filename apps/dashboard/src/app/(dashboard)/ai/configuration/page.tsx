"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface AiConfig {
  id: string;
  aiName: string;
  systemPrompt: string;
  model: "gpt-4o-mini" | "gpt-4o" | "gpt-4.1-mini" | "gpt-4.1";
}

const AI_MODEL_OPTIONS = [
  { value: "gpt-4o-mini", label: "GPT-4o mini", detail: "Cepat dan hemat untuk operasional harian." },
  { value: "gpt-4o", label: "GPT-4o", detail: "Kualitas respons lebih tinggi untuk percakapan kompleks." },
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini", detail: "Pilihan seimbang untuk instruksi dan reasoning." },
  { value: "gpt-4.1", label: "GPT-4.1", detail: "Reasoning dan kepatuhan instruksi paling kuat." },
] as const;

export default function AiConfigurationPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["ai-configuration"],
    queryFn: () => apiClient.get<AiConfig>("/api/v1/ai/configuration"),
  });
  const [form, setForm] = useState<AiConfig | null>(null);

  useEffect(() => {
    if (query.data) {
      setForm({
        id: query.data.id,
        aiName: query.data.aiName,
        systemPrompt: query.data.systemPrompt ?? "",
        model: query.data.model ?? "gpt-4o-mini",
      });
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      apiClient.put(`/api/v1/ai/configuration/${form!.id}`, {
        aiName: form!.aiName,
        systemPrompt: form!.systemPrompt,
        model: form!.model,
      }),
    onSuccess: () => {
      toast.push("Konfigurasi AI diperbarui.", "success");
      queryClient.invalidateQueries({ queryKey: ["ai-configuration"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menyimpan.", "error"),
  });

  if (!form) return <div className="flex-1 p-6 text-sm text-zinc-500">Memuat...</div>;

  return (
    <>
      <Topbar title="AI Configuration" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="AI configuration"
            description="Ruang konfigurasi AI dirapikan agar prompt inti, identitas assistant, dan batasan operasional bisa dibaca sebagai satu kontrol pusat."
            actions={
              <Button type="submit" form="ai-configuration-form" disabled={save.isPending}>
                {save.isPending ? "Menyimpan..." : "Simpan Konfigurasi"}
              </Button>
            }
          />
          <DashboardPageMetrics
            items={[
              { label: "AI name", value: form.aiName || "-", detail: "Nama assistant yang muncul di workspace dan percakapan." },
              { label: "Prompt lines", value: String(form.systemPrompt.split("\n").filter(Boolean).length), detail: "Jumlah baris instruksi aktif pada system prompt." },
              { label: "Knowledge source", value: "PUBLIC", detail: "AI hanya menggunakan knowledge base aktif dengan audience public." },
              { label: "Model", value: form.model, detail: "Model aktif untuk classify, answer, summary, dan suggested reply." },
            ]}
          />
          <DashboardTablePanel title="Asisten inti" detail="Kelola identitas AI dan instruksi dasar yang menjadi pondasi respons otomatis.">
            <form
              id="ai-configuration-form"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
              className="space-y-5 px-5 py-5 md:px-6 md:py-6"
            >
              <div>
                <Label htmlFor="aiName">Nama Asisten AI</Label>
                <Input id="aiName" value={form.aiName} onChange={(e) => setForm({ ...form, aiName: e.target.value })} />
              </div>

              <div>
                <Label htmlFor="model">Model AI</Label>
                <Select id="model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value as AiConfig["model"] })}>
                  {AI_MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.detail}
                    </option>
                  ))}
                </Select>
                <p className="mt-2 text-xs leading-5 text-zinc-500">Perubahan berlaku untuk conversation baru setelah konfigurasi disimpan.</p>
              </div>

              <div>
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  rows={10}
                  value={form.systemPrompt}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  placeholder={`Anda adalah {{aiName}}, asisten virtual resmi {{organizationName}}.
Jawab natural seperti chatbot AI customer service.
Gunakan Knowledge Base aktif sebagai sumber utama.
Jika informasi tidak ada di Knowledge Base, katakan jujur dan arahkan ke petugas manusia bila diperlukan.`}
                />
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Placeholder yang tersedia: <code>{"{{aiName}}"}</code>, <code>{"{{organizationName}}"}</code>, <code>{"{{language}}"}</code>, <code>{"{{evidence}}"}</code>.
                </p>
              </div>

            </form>
          </DashboardTablePanel>
        </div>
      </DashboardPage>
    </>
  );
}
