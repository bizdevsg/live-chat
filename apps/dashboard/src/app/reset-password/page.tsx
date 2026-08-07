"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
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
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-500">Minimal 10 karakter, kombinasi huruf besar, kecil, dan angka.</p>
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
