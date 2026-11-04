"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Input, Label, Textarea } from "@/components/ui/input";
import { FormActions, FormPage, FormSection } from "@/components/layout/form-page";

export default function NewTicketFromConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const backHref = `/inbox/${conversationId}`;

  const createTicket = useMutation({
    mutationFn: (body: { subject: string; description: string; category: string }) =>
      apiClient.post("/api/v1/tickets", { ...body, conversationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.push("Ticket berhasil dibuat.", "success");
      router.push(backHref);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat ticket.", "error"),
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <FormPage
        topbarTitle="Buat Ticket"
        title="Buat ticket"
        description="Ticket akan ditautkan ke percakapan ini."
        backHref={backHref}
        backLabel="Kembali ke percakapan"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTicket.mutate({ subject, description, category });
          }}
          className="space-y-6"
        >
          <FormSection title="Detail ticket">
            <div>
              <Label htmlFor="subject">Subjek</Label>
              <Input id="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="category">Kategori</Label>
              <Input id="category" required value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea id="description" required className="min-h-[140px]" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </FormSection>
          <FormActions cancelHref={backHref} submitLabel="Buat Ticket" pending={createTicket.isPending} />
        </form>
      </FormPage>
    </div>
  );
}
