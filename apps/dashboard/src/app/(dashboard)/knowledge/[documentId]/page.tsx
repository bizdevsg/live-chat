"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { Permission } from "@solidchat/shared";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

interface KnowledgeDocDetail {
  id: string;
  title: string;
  content: string;
  status: string;
  audience: string;
  version: number;
  chunks: Array<{ id: string; chunkIndex: number }>;
}

export default function KnowledgeDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const query = useQuery({ queryKey: ["knowledge", documentId], queryFn: () => apiClient.get<KnowledgeDocDetail>(`/api/v1/knowledge/documents/${documentId}`) });
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (query.data) {
      setTitle(query.data.title);
      setContent(query.data.content);
    }
  }, [query.data]);

  function useAction(fn: () => Promise<unknown>, successMessage: string) {
    return useMutation({
      mutationFn: fn,
      onSuccess: () => {
        toast.push(successMessage, "success");
        queryClient.invalidateQueries({ queryKey: ["knowledge", documentId] });
        queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      },
      onError: (err) => toast.push(err instanceof ApiError ? err.message : "Aksi gagal.", "error"),
    });
  }

  const save = useAction(() => apiClient.put(`/api/v1/knowledge/documents/${documentId}`, { title, content }), "Perubahan disimpan.");
  const submitReview = useAction(() => apiClient.post(`/api/v1/knowledge/documents/${documentId}/submit-review`), "Diajukan untuk review.");
  const approve = useAction(() => apiClient.post(`/api/v1/knowledge/documents/${documentId}/approve`), "Artikel disetujui.");
  const reject = useAction(() => apiClient.post(`/api/v1/knowledge/documents/${documentId}/reject`), "Artikel ditolak.");
  const publish = useAction(() => apiClient.post(`/api/v1/knowledge/documents/${documentId}/publish`), "Artikel dipublikasikan.");
  const archive = useAction(() => apiClient.post(`/api/v1/knowledge/documents/${documentId}/archive`), "Artikel diarsipkan.");

  if (!query.data) return <div className="flex-1 p-6 text-sm text-zinc-500">Memuat…</div>;
  const doc = query.data;
  const editable = ["DRAFT", "REJECTED", "IN_REVIEW"].includes(doc.status);

  return (
    <>
      <Topbar title={doc.title} />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>
              Versi {doc.version} · {doc.chunks.length} chunk terindeks
            </CardTitle>
            <Badge tone="gold">{doc.status}</Badge>
          </CardHeader>

          <div className="mb-4 space-y-4">
            <div>
              <Label htmlFor="title">Judul</Label>
              <Input id="title" value={title} disabled={!editable} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="content">Isi Artikel</Label>
              <Textarea id="content" rows={14} value={content} disabled={!editable} onChange={(e) => setContent(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {editable && hasPermission(Permission.KNOWLEDGE_EDIT) && (
              <Button variant="secondary" onClick={() => save.mutate()}>
                Simpan
              </Button>
            )}
            {(doc.status === "DRAFT" || doc.status === "REJECTED") && hasPermission(Permission.KNOWLEDGE_EDIT) && (
              <Button onClick={() => submitReview.mutate()}>Ajukan Review</Button>
            )}
            {doc.status === "IN_REVIEW" && hasPermission(Permission.KNOWLEDGE_APPROVE) && (
              <>
                <Button onClick={() => approve.mutate()}>Setujui</Button>
                <Button variant="danger" onClick={() => reject.mutate()}>
                  Tolak
                </Button>
              </>
            )}
            {doc.status === "APPROVED" && hasPermission(Permission.KNOWLEDGE_PUBLISH) && (
              <Button onClick={() => publish.mutate()}>Publikasikan</Button>
            )}
            {doc.status !== "ARCHIVED" && hasPermission(Permission.KNOWLEDGE_EDIT) && (
              <Button variant="ghost" onClick={() => archive.mutate()}>
                Arsipkan
              </Button>
            )}
          </div>
        </Card>
      </main>
    </>
  );
}
