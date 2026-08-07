"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

interface Team {
  id: string;
  name: string;
  description: string | null;
  capacityPerAgent: number;
  isActive: boolean;
  members: Array<{ user: { id: string; name: string } }>;
}

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacityPerAgent, setCapacityPerAgent] = useState(5);

  const query = useQuery({ queryKey: ["teams"], queryFn: () => apiClient.get<Team[]>("/api/v1/admin/teams") });

  const create = useMutation({
    mutationFn: () => apiClient.post("/api/v1/admin/teams", { name, description, capacityPerAgent }),
    onSuccess: () => {
      toast.push("Tim berhasil dibuat.", "success");
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setOpen(false);
      setName("");
      setDescription("");
    },
    onError: (err) => toast.push(err instanceof ApiError ? err.message : "Gagal membuat tim.", "error"),
  });

  return (
    <>
      <Topbar title="CS & Teams" />
      <main className="scrollbar-thin flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setOpen(true)}>+ Tim Baru</Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {query.data?.map((team) => (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle>{team.name}</CardTitle>
              </CardHeader>
              <p className="mb-2 text-xs text-zinc-500">{team.description}</p>
              <p className="text-xs text-zinc-500">Kapasitas per agent: {team.capacityPerAgent}</p>
              <p className="mt-2 text-xs text-zinc-400">{team.members.length} anggota</p>
              <ul className="mt-1 text-xs text-zinc-500">
                {team.members.map((m) => (
                  <li key={m.user.id}>• {m.user.name}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </main>

      <Modal open={open} title="Tim Baru" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="teamName">Nama Tim</Label>
            <Input id="teamName" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="teamDesc">Deskripsi</Label>
            <Input id="teamDesc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="capacity">Kapasitas Chat per Agent</Label>
            <Input id="capacity" type="number" min={1} value={capacityPerAgent} onChange={(e) => setCapacityPerAgent(Number(e.target.value))} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
