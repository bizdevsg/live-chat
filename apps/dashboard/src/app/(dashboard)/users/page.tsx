"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { isSuperAdminRole } from "@/lib/is-super-admin";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";

interface Role {
  id: string;
  slug: string;
  name: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: Array<{ role: Role }>;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const currentUserId = useAuthStore((s) => s.user?.userId);
  const currentUserRoles = useAuthStore((s) => s.user?.roles);
  const currentUserIsSuperAdmin = isSuperAdminRole(currentUserRoles);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => apiClient.get<UserRow[]>("/api/v1/admin/users") });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => apiClient.get<Role[]>("/api/v1/admin/users/roles") });
  const users = usersQuery.data ?? [];
  const activeUsers = users.filter((user) => user.isActive).length;
  const rolesCount = rolesQuery.data?.length ?? 0;
  const recentlyActive = users.filter((user) => {
    if (!user.lastLoginAt) return false;
    return Date.now() - new Date(user.lastLoginAt).getTime() <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.put(`/api/v1/admin/users/${id}`, { isActive }),
    onSuccess: invalidate,
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui user.", "error"),
  });

  const revokeSessions = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/admin/users/${id}/revoke-sessions`),
    onSuccess: () => {
      toast.push("Seluruh sesi user telah dicabut.", "success");
      setRevokeTarget(null);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal mencabut sesi.", "error"),
  });

  const revokeAllSessions = useMutation({
    mutationFn: () =>
      apiClient.post<{ usersRevoked: number; sessionsRevoked: number }>("/api/v1/admin/users/revoke-sessions"),
    onSuccess: ({ usersRevoked, sessionsRevoked }) => {
      toast.push(`Berhasil mencabut ${sessionsRevoked} sesi dari ${usersRevoked} user.`, "success");
      setRevokeAllOpen(false);
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal mencabut seluruh sesi user.", "error"),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/admin/users/${id}`),
    onSuccess: () => {
      toast.push("User berhasil dihapus.", "success");
      invalidate();
      setDeleteTarget(null);
      setDeleteConfirmText("");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menghapus user.", "error"),
  });

  return (
    <>
      <Topbar title="Users" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Users"
            description="Kelola akun, role, status akses, dan tindakan keamanan seperti revoke session atau hapus akun."
            actions={
              <div className="flex flex-wrap gap-2">
                {currentUserIsSuperAdmin ? (
                  <Button variant="danger" onClick={() => setRevokeAllOpen(true)}>
                    Cabut Semua Sesi
                  </Button>
                ) : null}
                <Link href="/users/new">
                  <Button>+ User Baru</Button>
                </Link>
              </div>
            }
          />
          <DashboardPageMetrics
            items={[
              { label: "User", value: String(users.length), detail: "Total akun yang tersedia di workspace." },
              { label: "Aktif", value: String(activeUsers), detail: "Akun yang saat ini diizinkan mengakses sistem." },
              { label: "Role tersedia", value: String(rolesCount), detail: "Jumlah role yang bisa dipakai pada pengaturan user." },
              { label: "Login 7 hari", value: String(recentlyActive), detail: "User yang tercatat login dalam 7 hari terakhir." },
            ]}
          />
          <DashboardTablePanel title="Daftar user" detail="Identitas, role, status, dan tindakan keamanan tiap akun.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className="text-left">
                  <tr>
                    <th className="px-5 py-3">Nama</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Login Terakhir</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/80">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold-500/20 bg-gold-500/10 text-xs font-semibold text-gold-300">
                            {user.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-zinc-100">{user.name}</div>
                            <div className="text-xs text-zinc-600">User {user.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-400">{user.email}</td>
                      <td className="px-5 py-3.5">
                        {user.roles.map((role) => (
                          <Badge key={role.role.id} className="mr-1">
                            {role.role.name}
                          </Badge>
                        ))}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("id-ID") : "-"}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Link href={`/users/${user.id}/edit`}>
                            <Button size="sm" variant="ghost">
                              Edit
                            </Button>
                          </Link>
                          <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate({ id: user.id, isActive: !user.isActive })}>
                            {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          {!isSuperAdminRole(user.roles.map(({ role }) => role.slug)) ? (
                            <Button size="sm" variant="ghost" onClick={() => setRevokeTarget(user)}>
                              Cabut Sesi
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            disabled={user.id === currentUserId}
                            title={user.id === currentUserId ? "Anda tidak dapat menghapus akun Anda sendiri" : undefined}
                            onClick={() => setDeleteTarget(user)}
                          >
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!usersQuery.isLoading && users.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <DashboardEmpty>Belum ada user yang dibuat.</DashboardEmpty>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DashboardTablePanel>
        </div>
      </DashboardPage>

      <ConfirmModal
        open={revokeAllOpen}
        title="Cabut Semua Sesi User"
        description="Seluruh sesi milik user non-Superadmin akan langsung dicabut dari semua perangkat. Akun Superadmin tetap aktif. Lanjutkan?"
        confirmLabel="Cabut Semua Sesi"
        danger
        onConfirm={() => revokeAllSessions.mutate()}
        onClose={() => setRevokeAllOpen(false)}
      />

      <ConfirmModal
        open={!!revokeTarget}
        title="Cabut Semua Sesi"
        description={`${revokeTarget?.name ?? "User ini"} akan langsung logout dari semua perangkat. Lanjutkan?`}
        confirmLabel="Cabut Sesi"
        danger
        onConfirm={() => revokeTarget && revokeSessions.mutate(revokeTarget.id)}
        onClose={() => setRevokeTarget(null)}
      />

      <Modal
        open={!!deleteTarget}
        title="Hapus User"
        onClose={() => {
          setDeleteTarget(null);
          setDeleteConfirmText("");
        }}
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            Tindakan ini akan menghapus akun <span className="font-medium text-zinc-200">{deleteTarget?.name}</span> ({deleteTarget?.email}) secara
            permanen beserta seluruh sesi dan pengaturannya. Tindakan ini tidak dapat dibatalkan.
          </p>
          <div>
            <Label htmlFor="delete-confirm">
              Ketik <span className="text-zinc-300">{deleteTarget?.name}</span> untuk konfirmasi
            </Label>
            <Input id="delete-confirm" autoComplete="off" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirmText("");
              }}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={!deleteTarget || deleteConfirmText !== deleteTarget.name || deleteUser.isPending}
              onClick={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}
            >
              {deleteUser.isPending ? "Menghapus..." : "Hapus Permanen"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
