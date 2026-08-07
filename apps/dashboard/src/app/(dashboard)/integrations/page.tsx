"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Integration {
  id: string;
  type: string;
  provider: string;
  name: string;
  isActive: boolean;
  logs: Array<{ id: string; action: string; status: string; createdAt: string }>;
}

export default function IntegrationsPage() {
  const query = useQuery({ queryKey: ["integrations"], queryFn: () => apiClient.get<Integration[]>("/api/v1/admin/integrations") });

  return (
    <>
      <Topbar title="Integrations" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6 space-y-4">
        {query.data?.map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <CardTitle>
                {integration.name} ({integration.type})
              </CardTitle>
              <Badge tone={integration.isActive ? "green" : "neutral"}>{integration.provider}</Badge>
            </CardHeader>
            <p className="mb-2 text-xs text-zinc-500">Log terakhir:</p>
            <ul className="space-y-1 text-xs text-zinc-500">
              {integration.logs.map((log) => (
                <li key={log.id} className="flex justify-between">
                  <span>{log.action}</span>
                  <Badge tone={log.status === "SUCCESS" ? "green" : "red"}>{log.status}</Badge>
                </li>
              ))}
              {integration.logs.length === 0 && <li>Belum ada aktivitas.</li>}
            </ul>
          </Card>
        ))}
        {query.data?.length === 0 && <p className="text-sm text-zinc-600">Belum ada integrasi terkonfigurasi. CRM default menggunakan Mock Adapter.</p>}
      </main>
    </>
  );
}
