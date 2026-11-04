"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RoutingRuleForm } from "@/components/routing/routing-rule-form";

function Content() {
  const siteId = useSearchParams().get("siteId") ?? "";
  return <RoutingRuleForm siteId={siteId} />;
}

export default function NewRoutingRulePage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
