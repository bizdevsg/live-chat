"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
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
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleSlug, setRoleSlug] = useState("cs_agent");

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

  const create = useMutation({
    mutationFn: () => apiClient.post<{ temporaryPassword: string }>("/api/v1/admin/users", { email, name, roleSlugs: [roleSlug] }),
    onSuccess: (data) => {
      toast.push(`User dibuat. Password sementara: ${data.temporaryPassword}`, "success");
      invalidate();
      setOpen(false);
      setEmail("");
      setName("");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat user.", "error"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.put(`/api/v1/admin/users/${id}`, { isActive }),
    onSuccess: invalidate,
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui user.", "error"),
  });

  const updateUser = useMutation({
    mutationFn: () =>
      apiClient.put(`/api/v1/admin/users/${editTarget!.id}`, {
        name,
        roleSlugs: [roleSlug],
      }),
    onSuccess: () => {
      toast.push("User berhasil diperbarui.", "success");
      invalidate();
      setEditTarget(null);
      setName("");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui user.", "error"),
  });

  const revokeSessions = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/admin/users/${id}/revoke-sessions`),
    onSuccess: () => toast.push("Seluruh sesi user telah dicabut.", "success"),
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal mencabut sesi.", "error"),
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
            description="Manajemen user ditata ulang agar role, status, dan aksi keamanan penting seperti revoke session atau delete account lebih mudah dipindai."
            actions={<Button onClick={() => setOpen(true)}>+ User Baru</Button>}
          />
          <DashboardPageMetrics
            items={[
              { label: "User", value: String(users.length), detail: "Total akun yang tersedia di workspace." },
              { label: "Aktif", value: String(activeUsers), detail: "Akun yang saat ini diizinkan mengakses sistem." },
              { label: "Role tersedia", value: String(rolesCount), detail: "Jumlah role yang bisa dipakai pada pengaturan user." },
              { label: "Login 7 hari", value: String(recentlyActive), detail: "User yang tercatat login dalam 7 hari terakhir." },
            ]}
          />
          <DashboardTablePanel title="User access matrix" detail="Kelola identitas, role, akses, dan tindakan keamanan tiap akun dari satu tabel kerja.">
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  <tr>
                    <th className="px-5 py-4">Nama</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Role</th>
                    <th className="px-5 py-4">Login Terakhir</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/80">
                  {users.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-ink-700/35">
                      <td className="px-5 py-4">
                        <div className="font-medium text-zinc-100">{user.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">User {user.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-5 py-4 text-zinc-400">{user.email}</td>
                      <td className="px-5 py-4">
                        {user.roles.map((role) => (
                          <Badge key={role.role.id} className="mr-1">
                            {role.role.name}
                          </Badge>
                        ))}
                      </td>
                      <td className="px-5 py-4 text-zinc-500">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("id-ID") : "-"}</td>
                      <td className="px-5 py-4">
                        <Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditTarget(user);
                              setName(user.name);
                              setRoleSlug(user.roles[0]?.role.slug ?? "cs_agent");
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate({ id: user.id, isActive: !user.isActive })}>
                            {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRevokeTarget(user.id)}>
                            Cabut Sesi
                          </Button>
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

      <Modal open={open} title="User Baru" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="name">Nama</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select id="role" value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)}>
              {rolesQuery.data?.map((role) => (
                <option key={role.id} value={role.slug}>
                  {role.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              Buat User
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editTarget}
        title={`Edit User${editTarget ? `: ${editTarget.name}` : ""}`}
        onClose={() => {
          setEditTarget(null);
          setName("");
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateUser.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="edit-name">Nama</Label>
            <Input id="edit-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="edit-role">Role</Label>
            <Select id="edit-role" value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)}>
              {rolesQuery.data?.map((role) => (
                <option key={role.id} value={role.slug}>
                  {role.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={updateUser.isPending}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!revokeTarget}
        title="Cabut Semua Sesi"
        description="User ini akan langsung logout dari semua perangkat. Lanjutkan?"
        confirmLabel="Cabut Sesi"
        danger
        onConfirm={() => revokeTarget && revokeSessions.mutate(revokeTarget)}
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
