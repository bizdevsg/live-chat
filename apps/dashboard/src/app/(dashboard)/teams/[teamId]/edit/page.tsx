"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Input, Label } from "@/components/ui/input";
import { FormActions, FormNotice, FormPage, FormSection } from "@/components/layout/form-page";

interface Team {
  id: string;
  name: string;
  description: string | null;
  capacityPerAgent: number;
  isActive: boolean;
  members: Array<{ user: { id: string; name: string } }>;
}

export default function EditTeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacityPerAgent, setCapacityPerAgent] = useState(5);
  const [hydrated, setHydrated] = useState(false);

  const query = useQuery({ queryKey: ["teams"], queryFn: () => apiClient.get<Team[]>("/api/v1/admin/teams") });
  const team = query.data?.find((item) => item.id === teamId);

  useEffect(() => {
    if (team && !hydrated) {
      setName(team.name);
      setDescription(team.description ?? "");
      setCapacityPerAgent(team.capacityPerAgent);
      setHydrated(true);
    }
  }, [team, hydrated]);

  const update = useMutation({
    mutationFn: () => apiClient.put(`/api/v1/admin/teams/${teamId}`, { name, description, capacityPerAgent }),
    onSuccess: () => {
      toast.push("Tim berhasil diperbarui.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      router.push("/teams");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui tim.", "error"),
  });

  return (
    <FormPage
      topbarTitle="Edit Tim"
      title={team ? `Edit ${team.name}` : "Edit tim"}
      backHref="/teams"
      backLabel="Kembali ke CS & Teams"
    >
      {query.isLoading ? (
        <FormNotice>Memuat data tim…</FormNotice>
      ) : !team ? (
        <FormNotice>Tim tidak ditemukan.</FormNotice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
          className="space-y-6"
        >
          <FormSection title="Detail tim">
            <div>
              <Label htmlFor="editTeamName">Nama Tim</Label>
              <Input id="editTeamName" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="editTeamDesc">Deskripsi</Label>
              <Input id="editTeamDesc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="editCapacity">Kapasitas Chat per Agent</Label>
              <Input id="editCapacity" type="number" min={1} value={capacityPerAgent} onChange={(e) => setCapacityPerAgent(Number(e.target.value))} />
            </div>
          </FormSection>
          <FormActions cancelHref="/teams" submitLabel="Simpan Perubahan" pending={update.isPending} />
        </form>
      )}
    </FormPage>
  );
}
