"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Input, Label, Select } from "@/components/ui/input";
import { FormActions, FormNotice, FormPage, FormSection } from "@/components/layout/form-page";
import { getPasswordPolicyError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@solidchat/shared";

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

export default function EditUserPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [roleSlug, setRoleSlug] = useState("cs_agent");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => apiClient.get<UserRow[]>("/api/v1/admin/users") });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => apiClient.get<Role[]>("/api/v1/admin/users/roles") });
  const user = usersQuery.data?.find((item) => item.id === userId);

  useEffect(() => {
    if (user && !hydrated) {
      setName(user.name);
      setRoleSlug(user.roles[0]?.role.slug ?? "cs_agent");
      setHydrated(true);
    }
  }, [user, hydrated]);

  const updateUser = useMutation({
    mutationFn: () =>
      apiClient.put(`/api/v1/admin/users/${userId}`, {
        name,
        roleSlugs: [roleSlug],
        ...(editPassword ? { password: editPassword } : {}),
      }),
    onSuccess: () => {
      toast.push("User berhasil diperbarui.", "success");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      router.push("/users");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal memperbarui user.", "error"),
  });

  return (
    <FormPage
      topbarTitle="Edit User"
      title={user ? `Edit ${user.name}` : "Edit user"}
      description={user?.email}
      backHref="/users"
      backLabel="Kembali ke Users"
    >
      {usersQuery.isLoading ? (
        <FormNotice>Memuat data user…</FormNotice>
      ) : !user ? (
        <FormNotice>User tidak ditemukan.</FormNotice>
      ) : (
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
          className="space-y-6"
        >
          <FormSection title="Profil & role">
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
          </FormSection>

          <FormSection title="Ganti password" description="Kosongkan jika tidak diubah. Jika diisi, password wajib memenuhi seluruh syarat keamanan.">
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
          </FormSection>

          <FormActions cancelHref="/users" submitLabel="Simpan Perubahan" pending={updateUser.isPending} />
        </form>
      )}
    </FormPage>
  );
}
