"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

function formatRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Live "Kembali ke AI dalam MM:SS" countdown for a conversation waiting on a human — the agent-side
 * mirror of the visitor-facing badge in the widget. Renders nothing once the deadline passes or when
 * there is no deadline (conversation not currently queued / already handled).
 */
export function AutoReturnCountdown({
  deadlineAt,
  compact = false,
}: {
  deadlineAt: string | null | undefined;
  compact?: boolean;
}) {
  const deadlineMs = deadlineAt ? new Date(deadlineAt).getTime() : NaN;
  const [remaining, setRemaining] = useState(() =>
    Number.isNaN(deadlineMs) ? 0 : Math.max(0, Math.round((deadlineMs - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (Number.isNaN(deadlineMs)) return;
    const tick = () => setRemaining(Math.max(0, Math.round((deadlineMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  if (Number.isNaN(deadlineMs) || remaining <= 0) return null;

  const tone = remaining <= 15 ? "red" : "amber";
  return (
    <Badge tone={tone} title="Percakapan otomatis kembali ke AI jika belum ada agent yang Accept">
      {compact ? `⏱ ${formatRemaining(remaining)}` : `Kembali ke AI dalam ${formatRemaining(remaining)}`}
    </Badge>
  );
}
