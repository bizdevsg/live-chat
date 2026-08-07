"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

interface Category {
  id: string;
  name: string;
}

export default function NewKnowledgeArticlePage() {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [audience, setAudience] = useState("PUBLIC");

  const categories = useQuery({ queryKey: ["knowledge-categories"], queryFn: () => apiClient.get<Category[]>("/api/v1/knowledge/categories") });

  const create = useMutation({
    mutationFn: () => apiClient.post<{ id: string }>("/api/v1/knowledge/documents", { title, content, categoryId: categoryId || undefined, audience }),
    onSuccess: (data) => {
      toast.push("Artikel dibuat sebagai DRAFT.", "success");
      router.replace(`/knowledge/${data.id}`);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat artikel.", "error"),
  });

  return (
    <>
      <Topbar title="Artikel Baru" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Card className="mx-auto max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="title">Judul</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Kategori</Label>
                <Select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">— Tanpa kategori —</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="audience">Audience</Label>
                <Select id="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="PUBLIC">PUBLIC (dapat dibaca AI customer)</option>
                  <option value="AGENT_ONLY">AGENT_ONLY (suggested reply saja)</option>
                  <option value="INTERNAL">INTERNAL</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="content">Isi Artikel</Label>
              <Textarea id="content" required minLength={20} rows={12} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={create.isPending}>
                Simpan sebagai Draft
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
