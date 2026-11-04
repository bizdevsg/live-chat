"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Label, Select } from "@/components/ui/input";
import { FormActions, FormNotice, FormPage, FormSection } from "@/components/layout/form-page";

interface Team {
  id: string;
  name: string;
  members: Array<{ user: { id: string; name: string } }>;
}

interface UserOption {
  id: string;
  name: string;
}

export default function AddTeamMemberPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [userId, setUserId] = useState("");

  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: () => apiClient.get<Team[]>("/api/v1/admin/teams") });
  const usersQuery = useQuery({ queryKey: ["team-users"], queryFn: () => apiClient.get<UserOption[]>("/api/v1/admin/teams/candidates") });
  const team = teamsQuery.data?.find((item) => item.id === teamId);

  const addMember = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/admin/teams/${teamId}/members`, { userId }),
    onSuccess: () => {
      toast.push("Anggota berhasil ditambahkan.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      router.push("/teams");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menambah anggota.", "error"),
  });

  return (
    <FormPage
      topbarTitle="Tambah Anggota"
      title={team ? `Tambah anggota ke ${team.name}` : "Tambah anggota"}
      description="Pilih user yang akan dimasukkan ke tim ini."
      backHref="/teams"
      backLabel="Kembali ke CS & Teams"
    >
      {teamsQuery.isLoading ? (
        <FormNotice>Memuat data tim…</FormNotice>
      ) : !team ? (
        <FormNotice>Tim tidak ditemukan.</FormNotice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!userId) return;
            addMember.mutate();
          }}
          className="space-y-6"
        >
          <FormSection title="Anggota baru">
            <div>
              <Label htmlFor="member">User</Label>
              <Select id="member" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Pilih user...</option>
                {usersQuery.data
                  ?.filter((user) => !team.members.some((member) => member.user.id === user.id))
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
              </Select>
            </div>
          </FormSection>
          <FormActions cancelHref="/teams" submitLabel="Tambah Anggota" pending={addMember.isPending} disabled={!userId} />
        </form>
      )}
    </FormPage>
  );
}
