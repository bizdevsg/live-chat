"use client";

import { useState } from "react";
import { getDashboardSocket } from "@/lib/socket";
import { Select } from "@/components/ui/input";

export function AgentStatusToggle() {
  const [availability, setAvailability] = useState("ONLINE");

  return (
    <Select
      value={availability}
      onChange={(e) => {
        setAvailability(e.target.value);
        getDashboardSocket().emit("agent:status", { availability: e.target.value });
      }}
      className="!h-8 w-32 !py-1 text-xs"
    >
      <option value="ONLINE">🟢 Online</option>
      <option value="BUSY">🟡 Busy</option>
      <option value="OFFLINE">⚪ Offline</option>
    </Select>
  );
}
