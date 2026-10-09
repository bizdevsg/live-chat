"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  getPasswordPolicyError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
} from "@solidchat/shared";

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => apiClient.post("/api/v1/auth/reset-password", { token, newPassword }),
    onSuccess: () => router.replace("/login"),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal mereset password."),
  });

  return (
    <Card className="w-full max-w-sm">
      <h1 className="mb-4 text-lg font-semibold text-zinc-100">Reset Password</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const passwordError = getPasswordPolicyError(newPassword);
          if (passwordError) {
            setError(passwordError);
            return;
          }
          if (newPassword !== confirmPassword) {
            setError("Password dan konfirmasi password harus sama.");
            return;
          }
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="newPassword">Password Baru</Label>
          <Input
            id="newPassword"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <ul className="mt-2 space-y-1 text-xs text-zinc-500" aria-label="Syarat password baru">
            {PASSWORD_REQUIREMENTS.map((requirement) => (
              <li key={requirement}>• {requirement}</li>
            ))}
          </ul>
        </div>
        <div>
          <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
          <Input
            id="confirmPassword"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={mutation.isPending || !token}>
          Reset Password
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
