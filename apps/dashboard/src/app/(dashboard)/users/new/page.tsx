"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Input, Label, Select } from "@/components/ui/input";
import { FormActions, FormPage, FormSection } from "@/components/layout/form-page";
import { getPasswordPolicyError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS } from "@solidchat/shared";

interface Role {
  id: string;
  slug: string;
  name: string;
}

export default function NewUserPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [roleSlug, setRoleSlug] = useState("cs_agent");

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => apiClient.get<Role[]>("/api/v1/admin/users/roles") });

  const create = useMutation({
    mutationFn: () => apiClient.post("/api/v1/admin/users", { email, name, password, roleSlugs: [roleSlug] }),
    onSuccess: () => {
      toast.push("User berhasil dibuat.", "success");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      router.push("/users");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat user.", "error"),
  });

  return (
    <FormPage
      topbarTitle="User Baru"
      title="User baru"
      description="Buat akun baru, tentukan role, dan set password awal sesuai kebijakan keamanan."
      backHref="/users"
      backLabel="Kembali ke Users"
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
        className="space-y-6"
      >
        <FormSection title="Identitas" description="Nama dan email yang dipakai untuk login.">
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
        </FormSection>

        <FormSection title="Password" description="Password awal untuk akun ini.">
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
        </FormSection>

        <FormActions cancelHref="/users" submitLabel="Buat User" pending={create.isPending} />
      </form>
    </FormPage>
  );
}
