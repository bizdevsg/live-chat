"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Input, Label } from "@/components/ui/input";
import { FormActions, FormNotice, FormPage, FormSection } from "@/components/layout/form-page";

interface Site {
  id: string;
  name: string;
}

export default function NewWidgetDomainPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [domain, setDomain] = useState("");

  const sitesQuery = useQuery({ queryKey: ["sites"], queryFn: () => apiClient.get<Site[]>("/api/v1/admin/sites") });
  const site = sitesQuery.data?.[0];

  const addDomain = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/admin/sites/${site!.id}/domains`, { domain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      router.push("/widget");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal menambah domain.", "error"),
  });

  return (
    <FormPage
      topbarTitle="Tambah Domain"
      title="Tambah domain"
      description="Hanya origin yang terdaftar yang boleh memuat widget."
      backHref="/widget"
      backLabel="Kembali ke Widget Settings"
    >
      {sitesQuery.isLoading ? (
        <FormNotice>Memuat…</FormNotice>
      ) : !site ? (
        <FormNotice>Site tidak ditemukan.</FormNotice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!domain) return;
            addDomain.mutate();
          }}
          className="space-y-6"
        >
          <FormSection title="Domain baru">
            <div>
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                required
                placeholder="sg-berjangka.com atau https://domain.com/path"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>
          </FormSection>
          <FormActions cancelHref="/widget" submitLabel="Tambah Domain" pending={addDomain.isPending} disabled={!domain} />
        </form>
      )}
    </FormPage>
  );
}
