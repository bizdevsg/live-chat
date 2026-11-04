"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { FormActions, FormNotice, FormPage, FormSection } from "@/components/layout/form-page";
import { TemplateVariablesHint } from "@/components/templates/template-variables-hint";

interface Template {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  language: string;
}

export default function EditTemplatePage() {
  const { templateId } = useParams<{ templateId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [shortcut, setShortcut] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("id");
  const [hydrated, setHydrated] = useState(false);

  const query = useQuery({ queryKey: ["templates"], queryFn: () => apiClient.get<Template[]>("/api/v1/admin/templates") });
  const template = query.data?.find((item) => item.id === templateId);

  useEffect(() => {
    if (template && !hydrated) {
      setShortcut(template.shortcut);
      setTitle(template.title);
      setContent(template.content);
      setLanguage(template.language);
      setHydrated(true);
    }
  }, [template, hydrated]);

  const update = useMutation({
    mutationFn: () => apiClient.put(`/api/v1/admin/templates/${templateId}`, { shortcut, title, content, language }),
    onSuccess: () => {
      toast.push("Template diperbarui.", "success");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      router.push("/templates");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui template.", "error"),
  });

  return (
    <FormPage
      topbarTitle="Edit Template"
      title={template ? `Edit /${template.shortcut}` : "Edit template"}
      backHref="/templates"
      backLabel="Kembali ke Templates"
    >
      {query.isLoading ? (
        <FormNotice>Memuat template…</FormNotice>
      ) : !template ? (
        <FormNotice>Template tidak ditemukan.</FormNotice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
          className="space-y-6"
        >
          <FormSection title="Detail template">
            <div>
              <Label htmlFor="edit-shortcut">Shortcut</Label>
              <Input id="edit-shortcut" required value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-title">Judul</Label>
              <Input id="edit-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-language">Bahasa</Label>
              <Select id="edit-language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-content">Isi</Label>
              <Textarea id="edit-content" required className="min-h-[160px]" value={content} onChange={(e) => setContent(e.target.value)} />
              <TemplateVariablesHint onInsert={(placeholder) => setContent((current) => current + placeholder)} />
            </div>
          </FormSection>
          <FormActions cancelHref="/templates" submitLabel="Simpan Perubahan" pending={update.isPending} />
        </form>
      )}
    </FormPage>
  );
}
