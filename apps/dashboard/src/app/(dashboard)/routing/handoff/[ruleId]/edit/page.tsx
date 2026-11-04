"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HandoffRuleForm } from "@/components/routing/handoff-rule-form";

function Content() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const siteId = useSearchParams().get("siteId") ?? "";
  return <HandoffRuleForm siteId={siteId} ruleId={ruleId} />;
}

export default function EditHandoffRulePage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
