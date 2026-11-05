/**
 * Rough USD cost estimation for an AI run, derived from token counts.
 *
 * Pricing is informational only (shown in the AI Runs dashboard) — it is not wired to
 * billing. Covers the models this app actually offers (see env.validation.ts for the
 * selectable OPENAI_DEFAULT_MODEL values and constants.ts for AI_MODELS.embedding).
 * Ollama models run locally and are always free. Anything outside this table returns
 * null so the UI shows "-" instead of a silently wrong number.
 */

interface ModelPricing {
  /** USD per 1,000,000 input tokens. */
  input: number;
  /** USD per 1,000,000 output tokens. */
  output: number;
}

const OPENAI_PRICING_PER_MILLION_TOKENS: Record<string, ModelPricing> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
};

export function estimateAiRunCostUsd(provider: string, model: string, inputTokens: number | null, outputTokens: number | null): number | null {
  if (provider === "ollama") return 0; // Local inference, no API billing.
  const pricing = OPENAI_PRICING_PER_MILLION_TOKENS[model];
  if (!pricing || (inputTokens == null && outputTokens == null)) return null;
  const cost = ((inputTokens ?? 0) * pricing.input + (outputTokens ?? 0) * pricing.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000; // Keep 6 decimal places (costs can be sub-cent).
}
