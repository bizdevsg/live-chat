"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { FormActions, FormPage, FormSection } from "@/components/layout/form-page";
import { TemplateVariablesHint } from "@/components/templates/template-variables-hint";

export default function NewTemplatePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [shortcut, setShortcut] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("id");

  const create = useMutation({
    mutationFn: () => apiClient.post("/api/v1/admin/templates", { shortcut, title, content, language }),
    onSuccess: () => {
      toast.push("Template dibuat.", "success");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      router.push("/templates");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat template.", "error"),
  });

  return (
    <FormPage
      topbarTitle="Template Baru"
      title="Template baru"
      description="Buat balasan cepat yang bisa dipanggil agent lewat shortcut."
      backHref="/templates"
      backLabel="Kembali ke Templates"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-6"
      >
        <FormSection title="Detail template">
          <div>
            <Label htmlFor="shortcut">Shortcut</Label>
            <Input id="shortcut" required placeholder="salam-pembuka" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="title">Judul</Label>
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="language">Bahasa</Label>
            <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="content">Isi</Label>
            <Textarea id="content" required className="min-h-[160px]" value={content} onChange={(e) => setContent(e.target.value)} />
            <TemplateVariablesHint onInsert={(placeholder) => setContent((current) => current + placeholder)} />
          </div>
        </FormSection>
        <FormActions cancelHref="/templates" submitLabel="Simpan" pending={create.isPending} />
      </form>
    </FormPage>
  );
}
