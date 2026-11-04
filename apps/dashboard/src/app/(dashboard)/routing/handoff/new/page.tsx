"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HandoffRuleForm } from "@/components/routing/handoff-rule-form";

function Content() {
  const siteId = useSearchParams().get("siteId") ?? "";
  return <HandoffRuleForm siteId={siteId} />;
}

export default function NewHandoffRulePage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
