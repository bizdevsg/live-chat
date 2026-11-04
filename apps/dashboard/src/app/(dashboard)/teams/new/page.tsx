"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Input, Label } from "@/components/ui/input";
import { FormActions, FormPage, FormSection } from "@/components/layout/form-page";

export default function NewTeamPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacityPerAgent, setCapacityPerAgent] = useState(5);

  const create = useMutation({
    mutationFn: () => apiClient.post("/api/v1/admin/teams", { name, description, capacityPerAgent }),
    onSuccess: () => {
      toast.push("Tim berhasil dibuat.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      router.push("/teams");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat tim.", "error"),
  });

  return (
    <FormPage
      topbarTitle="Tim Baru"
      title="Tim baru"
      description="Buat tim customer support dan tentukan kapasitas chat per agent."
      backHref="/teams"
      backLabel="Kembali ke CS & Teams"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-6"
      >
        <FormSection title="Detail tim">
          <div>
            <Label htmlFor="teamName">Nama Tim</Label>
            <Input id="teamName" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="teamDesc">Deskripsi</Label>
            <Input id="teamDesc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="capacity">Kapasitas Chat per Agent</Label>
            <Input id="capacity" type="number" min={1} value={capacityPerAgent} onChange={(e) => setCapacityPerAgent(Number(e.target.value))} />
          </div>
        </FormSection>
        <FormActions cancelHref="/teams" submitLabel="Simpan" pending={create.isPending} />
      </form>
    </FormPage>
  );
}
