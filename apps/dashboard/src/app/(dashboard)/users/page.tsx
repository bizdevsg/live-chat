"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal, ConfirmModal } from "@/components/ui/modal";

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
  const [open, setOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleSlug, setRoleSlug] = useState("cs_agent");

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => apiClient.get<UserRow[]>("/api/v1/admin/users") });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => apiClient.get<Role[]>("/api/v1/admin/users/roles") });

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

  const revokeSessions = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/admin/users/${id}/revoke-sessions`),
    onSuccess: () => toast.push("Seluruh sesi user telah dicabut.", "success"),
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal mencabut sesi.", "error"),
  });

  return (
    <>
      <Topbar title="Users" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setOpen(true)}>+ User Baru</Button>
        </div>
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Login Terakhir</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {usersQuery.data?.map((u) => (
                <tr key={u.id} className="border-t border-ink-700 hover:bg-ink-700/40">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.roles.map((r) => (
                      <Badge key={r.role.id} className="mr-1">
                        {r.role.name}
                      </Badge>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("id-ID") : "-"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.isActive ? "green" : "red"}>{u.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td className="flex gap-2 px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}>
                      {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRevokeTarget(u.id)}>
                      Cabut Sesi
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>

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
              {rolesQuery.data?.map((r) => (
                <option key={r.id} value={r.slug}>
                  {r.name}
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

      <ConfirmModal
        open={!!revokeTarget}
        title="Cabut Semua Sesi"
        description="User ini akan langsung logout dari semua perangkat. Lanjutkan?"
        confirmLabel="Cabut Sesi"
        danger
        onConfirm={() => revokeTarget && revokeSessions.mutate(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
      />
    </>
  );
}
