"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface Team {
  id: string;
  name: string;
  description: string | null;
  capacityPerAgent: number;
  isActive: boolean;
  members: Array<{ user: { id: string; name: string } }>;
}

interface UserOption {
  id: string;
  name: string;
}

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacityPerAgent, setCapacityPerAgent] = useState(5);
  const [memberToAdd, setMemberToAdd] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<Team | null>(null);

  const query = useQuery({ queryKey: ["teams"], queryFn: () => apiClient.get<Team[]>("/api/v1/admin/teams") });
  const usersQuery = useQuery({ queryKey: ["team-users"], queryFn: () => apiClient.get<UserOption[]>("/api/v1/admin/teams/candidates") });
  const teams = query.data ?? [];
  const activeTeams = teams.filter((team) => team.isActive).length;
  const totalMembers = teams.reduce((total, team) => total + team.members.length, 0);
  const averageCapacity = teams.length > 0 ? Math.round(teams.reduce((total, team) => total + team.capacityPerAgent, 0) / teams.length) : 0;

  const resetForm = () => {
    setName("");
    setDescription("");
    setCapacityPerAgent(5);
  };

  const create = useMutation({
    mutationFn: () => apiClient.post("/api/v1/admin/teams", { name, description, capacityPerAgent }),
    onSuccess: () => {
      toast.push("Tim berhasil dibuat.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setOpen(false);
      resetForm();
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat tim.", "error"),
  });

  const update = useMutation({
    mutationFn: () => apiClient.put(`/api/v1/admin/teams/${editTarget!.id}`, { name, description, capacityPerAgent }),
    onSuccess: () => {
      toast.push("Tim berhasil diperbarui.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setEditTarget(null);
      setName("");
      setDescription("");
      setCapacityPerAgent(5);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui tim.", "error"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.put(`/api/v1/admin/teams/${id}`, { isActive }),
    onSuccess: () => {
      toast.push("Status tim diperbarui.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui status tim.", "error"),
  });

  const addMember = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => apiClient.post(`/api/v1/admin/teams/${teamId}/members`, { userId }),
    onSuccess: () => {
      toast.push("Anggota berhasil ditambahkan.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menambah anggota.", "error"),
  });

  const removeMember = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) => apiClient.delete(`/api/v1/admin/teams/${teamId}/members/${userId}`),
    onSuccess: () => {
      toast.push("Anggota berhasil dihapus.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus anggota.", "error"),
  });

  const removeTeam = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/admin/teams/${id}`),
    onSuccess: () => {
      toast.push("Tim berhasil dihapus.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team-users"] });
      setDeleting(null);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus tim.", "error"),
  });

  return (
    <>
      <Topbar title="CS & Teams" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="CS & Teams"
            description="Halaman tim didesain ulang agar distribusi kapasitas, komposisi anggota, dan status aktivasi dapat dilihat sebagai operational map yang lebih jelas."
            actions={<Button onClick={() => setOpen(true)}>+ Tim Baru</Button>}
          />
          <DashboardPageMetrics
            items={[
              { label: "Tim", value: String(teams.length), detail: "Jumlah tim customer support yang terdaftar." },
              { label: "Aktif", value: String(activeTeams), detail: "Tim yang sedang bisa menerima assignment." },
              { label: "Anggota", value: String(totalMembers), detail: "Akumulasi anggota dari seluruh tim." },
              { label: "Avg capacity", value: String(averageCapacity), detail: "Rata-rata kapasitas chat per agent di seluruh tim." },
            ]}
          />
          <DashboardTablePanel title="Team roster" detail="Setiap kartu menyorot kapasitas, anggota aktif, dan aksi cepat untuk pengaturan tim.">
            <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2 md:px-6 md:py-6 xl:grid-cols-3">
              {teams.map((team) => (
                <section key={team.id} className="rounded-2xl border border-ink-600 bg-ink-800/70 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.12)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-100">{team.name}</h3>
                      <p className="mt-2 text-xs uppercase tracking-[0.24em] text-zinc-500">{team.capacityPerAgent} chat per agent</p>
                    </div>
                    <Badge tone={team.isActive ? "green" : "neutral"}>{team.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                  <p className="mb-2 mt-4 text-sm leading-6 text-zinc-500">{team.description}</p>
                  <p className="mt-2 text-xs text-zinc-400">{team.members.length} anggota</p>
                  <ul className="mt-3 space-y-2 text-xs text-zinc-500">
                    {team.members.map((member) => (
                      <li key={member.user.id} className="flex items-center justify-between gap-2 rounded-2xl border border-ink-600 bg-ink-900/70 px-3 py-2">
                        <span>{member.user.name}</span>
                        <button className="text-[11px] text-red-400 hover:underline" onClick={() => removeMember.mutate({ teamId: team.id, userId: member.user.id })}>
                          Hapus
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <Select value={memberToAdd[team.id] ?? ""} onChange={(e) => setMemberToAdd((prev) => ({ ...prev, [team.id]: e.target.value }))}>
                      <option value="">Pilih user...</option>
                      {usersQuery.data
                        ?.filter((user) => !team.members.some((member) => member.user.id === user.id))
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const userId = memberToAdd[team.id];
                        if (!userId) return;
                        addMember.mutate({ teamId: team.id, userId });
                        setMemberToAdd((prev) => ({ ...prev, [team.id]: "" }));
                      }}
                      disabled={!memberToAdd[team.id]}
                    >
                      Tambah
                    </Button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditTarget(team);
                        setName(team.name);
                        setDescription(team.description ?? "");
                        setCapacityPerAgent(team.capacityPerAgent);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate({ id: team.id, isActive: !team.isActive })}>
                      {team.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleting(team)}>
                      Hapus Tim
                    </Button>
                  </div>
                </section>
              ))}
              {!query.isLoading && teams.length === 0 ? <DashboardEmpty>Belum ada tim yang dibuat.</DashboardEmpty> : null}
            </div>
          </DashboardTablePanel>
        </div>
      </DashboardPage>

      <Modal
        open={open}
        title="Tim Baru"
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
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
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editTarget}
        title={`Edit Tim${editTarget ? `: ${editTarget.name}` : ""}`}
        onClose={() => {
          setEditTarget(null);
          resetForm();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
          className="space-y-3"
        >
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
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="Hapus Tim"
        description={`Tim "${deleting?.name ?? ""}" akan dihapus. Assignment conversation dan rule yang memakai tim ini akan dilepas.`}
        confirmLabel={removeTeam.isPending ? "Menghapus..." : "Hapus Tim"}
        danger
        onConfirm={() => {
          if (deleting) removeTeam.mutate(deleting.id);
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
