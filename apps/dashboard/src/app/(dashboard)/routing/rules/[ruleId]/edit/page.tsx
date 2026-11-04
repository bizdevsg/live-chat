"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { RoutingRuleForm } from "@/components/routing/routing-rule-form";

function Content() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const siteId = useSearchParams().get("siteId") ?? "";
  return <RoutingRuleForm siteId={siteId} ruleId={ruleId} />;
}

export default function EditRoutingRulePage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
