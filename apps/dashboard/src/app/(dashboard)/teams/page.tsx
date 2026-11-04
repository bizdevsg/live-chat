"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface Team {
  id: string;
  name: string;
  description: string | null;
  capacityPerAgent: number;
  isActive: boolean;
  members: Array<{ user: { id: string; name: string } }>;
}

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [deleting, setDeleting] = useState<Team | null>(null);

  const query = useQuery({ queryKey: ["teams"], queryFn: () => apiClient.get<Team[]>("/api/v1/admin/teams") });
  const teams = query.data ?? [];
  const activeTeams = teams.filter((team) => team.isActive).length;
  const totalMembers = teams.reduce((total, team) => total + team.members.length, 0);
  const averageCapacity = teams.length > 0 ? Math.round(teams.reduce((total, team) => total + team.capacityPerAgent, 0) / teams.length) : 0;

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.put(`/api/v1/admin/teams/${id}`, { isActive }),
    onSuccess: () => {
      toast.push("Status tim diperbarui.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui status tim.", "error"),
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
            description="Atur tim, kapasitas chat per agent, anggota, dan status aktivasi."
            actions={
              <Link href="/teams/new">
                <Button>+ Tim Baru</Button>
              </Link>
            }
          />
          <DashboardPageMetrics
            items={[
              { label: "Tim", value: String(teams.length), detail: "Jumlah tim customer support yang terdaftar." },
              { label: "Aktif", value: String(activeTeams), detail: "Tim yang sedang bisa menerima assignment." },
              { label: "Anggota", value: String(totalMembers), detail: "Akumulasi anggota dari seluruh tim." },
              { label: "Avg capacity", value: String(averageCapacity), detail: "Rata-rata kapasitas chat per agent di seluruh tim." },
            ]}
          />
          <DashboardTablePanel title="Team roster" detail="Kapasitas, anggota, dan aksi cepat untuk tiap tim.">
            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">
              {teams.map((team) => (
                <section key={team.id} className="flex flex-col rounded-xl border border-ink-600 bg-ink-900/60 p-4 transition-colors hover:border-ink-500">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">{team.name}</h3>
                      <p className="mt-1 text-xs text-zinc-500">{team.capacityPerAgent} chat per agent</p>
                    </div>
                    <Badge tone={team.isActive ? "green" : "neutral"}>{team.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                  {team.description ? <p className="mt-3 text-sm leading-6 text-zinc-500">{team.description}</p> : null}
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs font-medium text-zinc-400">{team.members.length} anggota</p>
                    <Link href={`/teams/${team.id}/members/new`} className="text-xs font-medium text-gold-300 hover:underline">
                      + Tambah anggota
                    </Link>
                  </div>
                  <ul className="mt-2 flex-1 space-y-1.5 text-xs text-zinc-400">
                    {team.members.map((member) => (
                      <li key={member.user.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2">
                        <span>{member.user.name}</span>
                        <button className="text-[11px] text-red-400 hover:underline" onClick={() => removeMember.mutate({ teamId: team.id, userId: member.user.id })}>
                          Hapus
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-ink-600 pt-3">
                    <Link href={`/teams/${team.id}/edit`}>
                      <Button size="sm" variant="ghost">
                        Edit
                      </Button>
                    </Link>
                    <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate({ id: team.id, isActive: !team.isActive })}>
                      {team.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => setDeleting(team)}>
                      Hapus Tim
                    </Button>
                  </div>
                </section>
              ))}
              {!query.isLoading && teams.length === 0 ? (
                <div className="col-span-full">
                  <DashboardEmpty>Belum ada tim yang dibuat.</DashboardEmpty>
                </div>
              ) : null}
            </div>
          </DashboardTablePanel>
        </div>
      </DashboardPage>

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
