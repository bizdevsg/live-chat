"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const mutation = useMutation({ mutationFn: () => apiClient.post("/api/v1/auth/forgot-password", { email }) });

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-4 text-lg font-semibold text-zinc-100">Lupa Password</h1>
        {mutation.isSuccess ? (
          <p className="text-sm text-emerald-400">
            Jika email terdaftar, tautan reset password telah dikirim. Silakan periksa email Anda.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              Kirim Tautan Reset
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
