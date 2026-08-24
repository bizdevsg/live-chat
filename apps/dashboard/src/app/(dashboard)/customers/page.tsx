"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Topbar } from "@/components/layout/topbar";
import {
  DashboardEmpty,
  DashboardPage,
  DashboardPageHeader,
  DashboardPageMetrics,
  DashboardTablePanel,
} from "@/components/layout/dashboard-page";

interface Customer { id: string; name: string; email: string | null; phone: string | null; accountStatus: string | null; createdAt: string; }

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({ queryKey: ["customers", deferredSearch], queryFn: () => apiClient.get<Customer[]>(`/api/v1/admin/customers${deferredSearch ? `?search=${encodeURIComponent(deferredSearch)}` : ""}`) });
  const customers = query.data ?? [];
  const customersWithEmail = customers.filter((customer) => !!customer.email).length;
  const customersWithPhone = customers.filter((customer) => !!customer.phone).length;
  const recentCustomers = customers.filter((customer) => Date.now() - new Date(customer.createdAt).getTime() <= 1000 * 60 * 60 * 24 * 30).length;

  return (
    <>
      <Topbar title="Customers" />
      <DashboardPage>
        <div className="space-y-6">
          <DashboardPageHeader
            title="Customers"
            description="Direktori customer kini ditata ulang agar tim bisa membaca identitas, status akun, dan jejak onboarding lebih cepat dari satu layar kerja."
          />
          <DashboardPageMetrics
            items={[
              { label: "Total customer", value: String(customers.length), detail: "Seluruh kontak yang sudah terhubung ke workspace." },
              { label: "Email terisi", value: String(customersWithEmail), detail: "Customer dengan alamat email yang bisa dipakai follow-up." },
              { label: "Nomor aktif", value: String(customersWithPhone), detail: "Kontak yang memiliki nomor telepon atau WhatsApp." },
              { label: "30 hari terakhir", value: String(recentCustomers), detail: "Customer baru yang bergabung dalam 1 bulan terakhir." },
            ]}
          />
          <DashboardTablePanel
            title="Customer directory"
            detail={`${customers.length} customer ditampilkan${deferredSearch ? ` untuk kata kunci “${deferredSearch}”` : ""}.`}
            toolbar={
              <label className="relative block w-full">
                <span className="sr-only">Cari customer</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nama, email, atau telepon..."
                  className="h-11 w-full rounded-2xl border border-ink-600 bg-ink-900 py-2 pl-10 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-gold-500"
                />
              </label>
            }
          >
            <div className="overflow-x-auto">
              <table className="min-w-[780px] w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Customer</th>
                    <th className="px-5 py-4 font-medium">Email</th>
                    <th className="px-5 py-4 font-medium">Telepon</th>
                    <th className="px-5 py-4 font-medium">Status akun</th>
                    <th className="px-5 py-4 font-medium">Bergabung</th>
                    <th className="w-10 px-3 py-4">
                      <span className="sr-only">Detail</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/80">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="group transition-colors hover:bg-ink-700/35">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-ink-600 bg-ink-700/60 text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">
                            {customer.name.slice(0, 2)}
                          </div>
                          <div>
                            <Link href={`/customers/${customer.id}`} className="font-medium text-zinc-100 transition-colors hover:text-gold-400">
                              {customer.name}
                            </Link>
                            <p className="mt-1 text-xs text-zinc-500">ID {customer.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-zinc-400">{customer.email ?? "-"}</td>
                      <td className="px-5 py-4 text-zinc-400">{customer.phone ?? "-"}</td>
                      <td className="px-5 py-4 text-zinc-400">{customer.accountStatus ?? "-"}</td>
                      <td className="px-5 py-4 text-zinc-500">
                        {new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(customer.createdAt))}
                      </td>
                      <td className="px-3 py-4">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="grid h-9 w-9 place-items-center rounded-2xl border border-transparent text-zinc-500 transition-all hover:border-ink-600 hover:bg-ink-700 hover:text-gold-400"
                        >
                          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {query.isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-14 text-center text-sm text-zinc-500">
                        Memuat customer...
                      </td>
                    </tr>
                  ) : null}
                  {!query.isLoading && customers.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <DashboardEmpty>Belum ada customer yang sesuai.</DashboardEmpty>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DashboardTablePanel>
        </div>
      </DashboardPage>
    </>
  );
}
