"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

interface Template {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  language: string;
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [shortcut, setShortcut] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const query = useQuery({ queryKey: ["templates"], queryFn: () => apiClient.get<Template[]>("/api/v1/admin/templates") });

  const create = useMutation({
    mutationFn: () => apiClient.post("/api/v1/admin/templates", { shortcut, title, content }),
    onSuccess: () => {
      toast.push("Template dibuat.", "success");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setOpen(false);
      setShortcut("");
      setTitle("");
      setContent("");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat template.", "error"),
  });

  return (
    <>
      <Topbar title="Response Templates" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setOpen(true)}>+ Template Baru</Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {query.data?.map((t) => (
            <Card key={t.id}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-xs text-gold-500">/{t.shortcut}</span>
                <span className="text-xs text-zinc-600">{t.language}</span>
              </div>
              <p className="mb-1 text-sm font-medium text-zinc-200">{t.title}</p>
              <p className="text-xs text-zinc-500">{t.content}</p>
            </Card>
          ))}
        </div>
      </main>

      <Modal open={open} title="Template Baru" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="shortcut">Shortcut</Label>
            <Input id="shortcut" required placeholder="salam-pembuka" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="title">Judul</Label>
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="content">Isi</Label>
            <Textarea id="content" required value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
