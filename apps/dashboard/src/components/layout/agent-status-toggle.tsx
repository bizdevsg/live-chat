"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getDashboardSocket } from "@/lib/socket";
import { useAuthStore } from "@/lib/auth-store";
import { Select } from "@/components/ui/input";

type Availability = "ONLINE" | "BUSY" | "OFFLINE";

export function AgentStatusToggle() {
  const userId = useAuthStore((state) => state.user?.userId);
  const statusQuery = useQuery({
    queryKey: ["agent", "status"],
    queryFn: () => apiClient.get<{ availability: Availability }>("/api/v1/agent/status"),
    staleTime: Infinity,
  });
  const [availability, setAvailability] = useState<Availability>("OFFLINE");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (statusQuery.data) setAvailability(statusQuery.data.availability);
  }, [statusQuery.data]);

  // Keep this toggle in sync when the same agent flips status from another tab/device, or an admin
  // changes it — the API broadcasts `agent:status` to every dashboard client in the org.
  useEffect(() => {
    if (!userId) return;
    const socket = getDashboardSocket();
    const onStatus = (payload: { userId?: string; availability?: Availability }) => {
      if (payload?.userId === userId && payload.availability) setAvailability(payload.availability);
    };
    socket.on("agent:status", onStatus);
    return () => {
      socket.off("agent:status", onStatus);
    };
  }, [userId]);

  return (
    <Select
      value={availability}
      onChange={async (e) => {
        const next = e.target.value as Availability;
        const previous = availability;
        setAvailability(next);
        setUpdating(true);
        try {
          await apiClient.post("/api/v1/agent/status", { availability: next });
          await statusQuery.refetch();
        } catch {
          setAvailability(previous);
        } finally {
          setUpdating(false);
        }
      }}
      disabled={updating || statusQuery.isLoading}
      className="!h-8 w-32 !py-1 text-xs"
    >
      <option value="ONLINE">🟢 Online</option>
      <option value="BUSY">🟡 Busy</option>
      <option value="OFFLINE">⚪ Offline</option>
    </Select>
  );
}
