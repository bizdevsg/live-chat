"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getDashboardSocket } from "@/lib/socket";
import { Select } from "@/components/ui/input";

type Availability = "ONLINE" | "BUSY" | "OFFLINE";

export function AgentStatusToggle() {
  const statusQuery = useQuery({
    queryKey: ["agent", "status"],
    queryFn: () => apiClient.get<{ availability: Availability }>("/api/v1/agent/status"),
    staleTime: Infinity,
  });
  const [availability, setAvailability] = useState<Availability>("OFFLINE");

  useEffect(() => {
    if (statusQuery.data) setAvailability(statusQuery.data.availability);
  }, [statusQuery.data]);

  return (
    <Select
      value={availability}
      onChange={(e) => {
        const next = e.target.value as Availability;
        setAvailability(next);
        getDashboardSocket().emit("agent:status", { availability: next });
      }}
      className="!h-8 w-32 !py-1 text-xs"
    >
      <option value="ONLINE">🟢 Online</option>
      <option value="BUSY">🟡 Busy</option>
      <option value="OFFLINE">⚪ Offline</option>
    </Select>
  );
}
