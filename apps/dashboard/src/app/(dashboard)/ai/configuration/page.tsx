"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

interface AiConfig {
  id: string;
  aiName: string;
  systemPrompt: string;
}

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
      });
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      apiClient.put(`/api/v1/ai/configuration/${form!.id}`, {
        aiName: form!.aiName,
        systemPrompt: form!.systemPrompt,
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
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle>Konfigurasi AI</CardTitle>
          </CardHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-5"
          >
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-4 py-3 text-sm leading-6 text-zinc-300">
              AI otomatis mengambil jawaban dari <span className="font-medium text-zinc-100">Knowledge Base aktif</span> dengan audience <span className="font-medium text-zinc-100">PUBLIC</span>.
              Artikel yang masih <span className="font-medium text-zinc-100">NON_ACTIVE</span> tidak akan dipakai sampai diaktifkan.
              Provider dan model AI sudah tetap (OpenAI, <code>gpt-4o-mini</code>) dan tidak perlu diatur di sini.
            </div>

            <div>
              <Label htmlFor="aiName">Nama Asisten AI</Label>
              <Input id="aiName" value={form.aiName} onChange={(e) => setForm({ ...form, aiName: e.target.value })} />
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

            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending}>
                Simpan Konfigurasi
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
