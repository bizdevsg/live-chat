"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CustomerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  accountStatus: string | null;
  conversations: Array<{ id: string; status: string; createdAt: string; intent: string | null }>;
  tickets: Array<{ id: string; ticketNumber: string; subject: string; status: string }>;
  tags: Array<{ tag: { id: string; name: string } }>;
}

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const query = useQuery({ queryKey: ["customer", customerId], queryFn: () => apiClient.get<CustomerDetail>(`/api/v1/admin/customers/${customerId}`) });

  if (!query.data) return <div className="flex-1 p-6 text-sm text-zinc-500">Memuat…</div>;
  const customer = query.data;

  return (
    <>
      <Topbar title={customer.name} />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-300">{customer.email ?? "-"}</dd>
            <dt className="text-zinc-500">Telepon</dt>
            <dd className="text-zinc-300">{customer.phone ?? "-"}</dd>
            <dt className="text-zinc-500">Status Akun</dt>
            <dd className="text-zinc-300">{customer.accountStatus ?? "-"}</dd>
          </dl>
          <div className="mt-3 flex gap-1">
            {customer.tags.map((t) => (
              <Badge key={t.tag.id}>{t.tag.name}</Badge>
            ))}
          </div>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Riwayat Conversation</CardTitle>
          </CardHeader>
          <ul className="space-y-1 text-sm text-zinc-400">
            {customer.conversations.map((c) => (
              <li key={c.id} className="flex justify-between border-b border-ink-700 py-1.5">
                <span>{c.intent ?? "Belum diklasifikasi"}</span>
                <Badge>{c.status}</Badge>
              </li>
            ))}
            {customer.conversations.length === 0 && <p className="text-zinc-600">Belum ada percakapan.</p>}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ticket</CardTitle>
          </CardHeader>
          <ul className="space-y-1 text-sm text-zinc-400">
            {customer.tickets.map((t) => (
              <li key={t.id} className="flex justify-between border-b border-ink-700 py-1.5">
                <span>{t.subject}</span>
                <Badge>{t.status}</Badge>
              </li>
            ))}
            {customer.tickets.length === 0 && <p className="text-zinc-600">Belum ada ticket.</p>}
          </ul>
        </Card>
      </main>
    </>
  );
}
