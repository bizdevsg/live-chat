"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/lib/auth-store";
import { isSuperAdminRole } from "@/lib/is-super-admin";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal, ConfirmModal } from "@/components/ui/modal";
import { DashboardEmpty, DashboardPage, DashboardPageHeader, DashboardPageMetrics, DashboardTablePanel } from "@/components/layout/dashboard-page";
import {
  getPasswordPolicyError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
} from "@solidchat/shared";

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
  const [open, setOpen] = useState(false);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
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
    mutationFn: () => apiClient.post("/api/v1/admin/users", { email, name, password, roleSlugs: [roleSlug] }),
    onSuccess: () => {
      toast.push("User berhasil dibuat.", "success");
      invalidate();
      setOpen(false);
      setEmail("");
      setName("");
      setPassword("");
      setConfirmPassword("");
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
        ...(editPassword ? { password: editPassword } : {}),
      }),
    onSuccess: () => {
      toast.push("User berhasil diperbarui.", "success");
      invalidate();
      setEditTarget(null);
      setName("");
      setEditPassword("");
      setEditConfirmPassword("");
    },
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
            description="Manajemen user ditata ulang agar role, status, dan aksi keamanan penting seperti revoke session atau delete account lebih mudah dipindai."
            actions={
              <div className="flex flex-wrap gap-2">
                {currentUserIsSuperAdmin ? (
                  <Button variant="danger" onClick={() => setRevokeAllOpen(true)}>
                    Cabut Semua Sesi
                  </Button>
                ) : null}
                <Button
                  onClick={() => {
                    setEmail("");
                    setName("");
                    setPassword("");
                    setConfirmPassword("");
                    setRoleSlug("cs_agent");
                    setOpen(true);
                  }}
                >
                  + User Baru
                </Button>
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
                              setEditPassword("");
                              setEditConfirmPassword("");
                            }}
                          >
                            Edit
                          </Button>
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

      <Modal
        open={open}
        title="User Baru"
        onClose={() => {
          setOpen(false);
          setPassword("");
          setConfirmPassword("");
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const passwordError = getPasswordPolicyError(password);
            if (passwordError) {
              toast.push(passwordError, "error");
              return;
            }
            if (password !== confirmPassword) {
              toast.push("Password dan konfirmasi password harus sama.", "error");
              return;
            }
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <ul className="mt-2 space-y-1 text-xs text-zinc-500" aria-label="Syarat password">
              {PASSWORD_REQUIREMENTS.map((requirement) => (
                <li key={requirement}>• {requirement}</li>
              ))}
            </ul>
          </div>
          <div>
            <Label htmlFor="confirm-password">Konfirmasi Password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
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
          setEditPassword("");
          setEditConfirmPassword("");
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const passwordError = editPassword ? getPasswordPolicyError(editPassword) : null;
            if (passwordError) {
              toast.push(passwordError, "error");
              return;
            }
            if (editPassword !== editConfirmPassword) {
              toast.push("Password dan konfirmasi password harus sama.", "error");
              return;
            }
            updateUser.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="edit-name">Nama</Label>
            <Input id="edit-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="edit-password">Password Baru</Label>
            <Input
              id="edit-password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Kosongkan jika tidak diubah"
            />
            <p className="mt-1 text-xs text-zinc-500">Kosongkan jika tidak diubah. Jika diisi, password wajib memenuhi seluruh syarat keamanan.</p>
          </div>
          <div>
            <Label htmlFor="edit-confirm-password">Konfirmasi Password Baru</Label>
            <Input
              id="edit-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={editPassword ? PASSWORD_MIN_LENGTH : undefined}
              maxLength={PASSWORD_MAX_LENGTH}
              value={editConfirmPassword}
              onChange={(e) => setEditConfirmPassword(e.target.value)}
              placeholder="Kosongkan jika password tidak diubah"
            />
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
