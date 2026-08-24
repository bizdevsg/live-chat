"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardPage, DashboardPageHeader, DashboardPageMetrics } from "@/components/layout/dashboard-page";

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
  const lastConversation = customer.conversations[0];

  return (
    <>
      <Topbar title={customer.name} />
      <DashboardPage>
        <div className="space-y-6">
        <DashboardPageHeader
          title={customer.name}
          description="Profil customer kini menempatkan identitas, percakapan, dan ticket support dalam layout yang lebih cepat dibaca oleh agent maupun admin."
        />
        <DashboardPageMetrics
          items={[
            { label: "Email", value: customer.email ?? "-", detail: "Alamat email utama customer." },
            { label: "Telepon", value: customer.phone ?? "-", detail: "Nomor kontak utama customer." },
            { label: "Conversation", value: String(customer.conversations.length), detail: lastConversation ? `Terakhir ${new Date(lastConversation.createdAt).toLocaleDateString("id-ID")}` : "Belum ada percakapan." },
            { label: "Ticket", value: String(customer.tickets.length), detail: `${customer.tags.length} tag terpasang pada profil.` },
          ]}
        />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="mb-0">
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

        <div className="space-y-6">
        <Card className="mb-0">
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
        </div>
        </div>
        </div>
      </DashboardPage>
    </>
  );
}
