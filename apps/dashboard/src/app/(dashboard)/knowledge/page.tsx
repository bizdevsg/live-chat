"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

interface KnowledgeDoc {
  id: string;
  title: string;
  status: string;
  audience: string;
  version: number;
  updatedAt: string;
}

const STATUS_TONE: Record<string, "neutral" | "gold" | "green" | "red" | "amber" | "blue"> = {
  DRAFT: "neutral",
  IN_REVIEW: "amber",
  APPROVED: "blue",
  PUBLISHED: "green",
  EXPIRED: "neutral",
  ARCHIVED: "neutral",
  REJECTED: "red",
};

export default function KnowledgePage() {
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["knowledge", status],
    queryFn: () => apiClient.get<{ items: KnowledgeDoc[] }>(`/api/v1/knowledge/documents${status ? `?status=${status}` : ""}`),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiClient.upload("/api/v1/knowledge/upload", formData);
    },
    onSuccess: () => {
      toast.push("Dokumen berhasil diunggah sebagai DRAFT.", "success");
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal mengunggah dokumen.", "error"),
  });

  return (
    <>
      <Topbar title="Knowledge Base" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
            <option value="">Semua status</option>
            {["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "EXPIRED", "ARCHIVED", "REJECTED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.csv,.html"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = "";
              }}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
              Upload Dokumen
            </Button>
            <Link href="/knowledge/new">
              <Button>+ Artikel Baru</Button>
            </Link>
          </div>
        </div>

        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Judul</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Versi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Diperbarui</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((doc) => (
                <tr key={doc.id} className="border-t border-ink-700 hover:bg-ink-700/40">
                  <td className="px-4 py-3">
                    <Link href={`/knowledge/${doc.id}`} className="text-gold-500 hover:underline">
                      {doc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{doc.audience}</td>
                  <td className="px-4 py-3 text-zinc-400">v{doc.version}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[doc.status] ?? "neutral"}>{doc.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(doc.updatedAt).toLocaleDateString("id-ID")}</td>
                </tr>
              ))}
              {query.data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-600">
                    Belum ada artikel.
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
