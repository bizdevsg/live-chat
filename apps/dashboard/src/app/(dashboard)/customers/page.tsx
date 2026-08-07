"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  accountStatus: string | null;
  createdAt: string;
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["customers", search],
    queryFn: () => apiClient.get<Customer[]>(`/api/v1/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  return (
    <>
      <Topbar title="Customers" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <Input
          placeholder="Cari nama, email, atau nomor telepon…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-sm"
        />
        <Card className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Telepon</th>
                <th className="px-4 py-3">Status Akun</th>
                <th className="px-4 py-3">Bergabung</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.map((c) => (
                <tr key={c.id} className="border-t border-ink-700 hover:bg-ink-700/40">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="text-gold-500 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{c.email ?? "-"}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.phone ?? "-"}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.accountStatus ?? "-"}</td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(c.createdAt).toLocaleDateString("id-ID")}</td>
                </tr>
              ))}
              {query.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-600">
                    Tidak ada customer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </main>
    </>
  );
}
