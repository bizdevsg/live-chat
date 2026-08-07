"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

interface AiConfig {
  id: string;
  provider: string;
  classifierModel: string;
  answerModel: string;
  summaryModel: string;
  suggestedReplyModel: string;
  embeddingModel: string;
  confidenceThreshold: number;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
}

export default function AiConfigurationPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ["ai-configuration"], queryFn: () => apiClient.get<AiConfig>("/api/v1/ai/configuration") });
  const [form, setForm] = useState<AiConfig | null>(null);

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => apiClient.put(`/api/v1/ai/configuration/${form!.id}`, form),
    onSuccess: () => {
      toast.push("Konfigurasi AI diperbarui.", "success");
      queryClient.invalidateQueries({ queryKey: ["ai-configuration"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menyimpan.", "error"),
  });

  if (!form) return <div className="flex-1 p-6 text-sm text-zinc-500">Memuat…</div>;

  return (
    <>
      <Topbar title="AI Configuration" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Model &amp; Perilaku AI</CardTitle>
          </CardHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="provider">Provider</Label>
              <Select id="provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                <option value="mock">Mock (development/testing)</option>
                <option value="openai">OpenAI</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="classifierModel">Model Klasifikasi Intent</Label>
                <Input id="classifierModel" value={form.classifierModel} onChange={(e) => setForm({ ...form, classifierModel: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="answerModel">Model Jawaban</Label>
                <Input id="answerModel" value={form.answerModel} onChange={(e) => setForm({ ...form, answerModel: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="summaryModel">Model Ringkasan</Label>
                <Input id="summaryModel" value={form.summaryModel} onChange={(e) => setForm({ ...form, summaryModel: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="suggestedReplyModel">Model Suggested Reply</Label>
                <Input id="suggestedReplyModel" value={form.suggestedReplyModel} onChange={(e) => setForm({ ...form, suggestedReplyModel: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="embeddingModel">Model Embedding</Label>
                <Input id="embeddingModel" value={form.embeddingModel} onChange={(e) => setForm({ ...form, embeddingModel: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="confidenceThreshold">Confidence Threshold</Label>
                <Input
                  id="confidenceThreshold"
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  value={form.confidenceThreshold}
                  onChange={(e) => setForm({ ...form, confidenceThreshold: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input id="maxTokens" type="number" value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="timeoutMs">Timeout (ms)</Label>
                <Input id="timeoutMs" type="number" value={form.timeoutMs} onChange={(e) => setForm({ ...form, timeoutMs: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="maxRetries">Max Retries</Label>
                <Input id="maxRetries" type="number" value={form.maxRetries} onChange={(e) => setForm({ ...form, maxRetries: Number(e.target.value) })} />
              </div>
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
