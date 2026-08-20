"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccountSettingsPanel } from "@/components/account/account-settings-panel";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const router = useRouter();

  const logoutAll = useMutation({
    mutationFn: () => apiClient.post("/api/v1/auth/logout-all"),
    onSuccess: () => {
      toast.push("Semua sesi telah dicabut. Silakan login kembali.", "success");
      router.replace("/login");
    },
  });

  if (!user) return null;

  return (
    <>
      <Topbar title="Profile & Security" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6 space-y-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{user.name}</CardTitle>
          </CardHeader>
          <p className="mb-3 text-sm text-zinc-400">{user.email}</p>
          <div className="mb-4 flex flex-wrap gap-1">
            {user.roles.map((r) => (
              <Badge key={r}>{r}</Badge>
            ))}
          </div>
          <Button variant="danger" onClick={() => logoutAll.mutate()}>
            Cabut Semua Sesi (Logout dari semua perangkat)
          </Button>
        </Card>

        <AccountSettingsPanel />
      </main>
    </>
  );
}
