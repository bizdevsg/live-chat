# AI Setup

## 1. Provider

The system only runs on real OpenAI — there is no mock/dummy AI mode anymore. `AiProviderFactory`
(`apps/api/src/ai/ai-provider.factory.ts`) always builds `OpenAiProvider`. If `OPENAI_API_KEY` is
missing, the API refuses to start (`env.validation.ts` requires it) rather than silently
degrading conversations to a canned template — that silent-fallback behavior is exactly what
caused confusing, non-AI answers in production before, so it was removed on purpose.

Required in `.env`:

```env
OPENAI_API_KEY=sk-...
```

Model names, confidence threshold, and retry/timeout are **not** configurable via env or
dashboard — they're fixed constants in `packages/shared/src/constants.ts` (`AI_MODELS`,
`DEFAULT_CONFIDENCE_THRESHOLD`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES`). To change a model or
threshold, edit that file and redeploy.

There is deliberately **no output token cap** on answer generation — a cap risks truncating the
model's JSON response mid-answer (which breaks `JSON.parse` and silently falls back to a generic
canned reply), which is exactly the kind of "AI ignores the KB" symptom this was removed to avoid.
The model's own context-window ceiling is the only limit; the system prompt asks for concise
2-5 sentence answers to keep responses on-topic regardless.

Current values:

```text
Classifier / Answer / Summary / Suggested Reply model   gpt-4o-mini
Embedding model                                         text-embedding-3-small
Confidence threshold                                    0.65
Max output tokens                                       none (uncapped)
Timeout                                                  20000 ms
Max retries                                              2
```

## 2. Dashboard AI Configuration

Only `aiName` and `systemPrompt` are editable from **AI Configuration** in the dashboard.
Provider and model are fixed (OpenAI / gpt-4o-mini) and shown as read-only info.

## 3. Steps for the AI to actually answer

1. Set `OPENAI_API_KEY` in `.env` and restart the API.
2. Log in to the dashboard.
3. Create a Knowledge Base article with real company information.
4. Run the workflow **Ajukan Review → Setujui → Publikasikan**.

Without publishing, customer-facing AI will keep saying it doesn't have enough information —
customer-facing AI only ever answers from articles that are `PUBLISHED`/`ACTIVE`. Draft, in-review,
approved-but-unpublished, and archived articles are never used (enforced in the retrieval SQL
itself, not just app logic).

## 4. Troubleshooting

- **AI always says information isn't available**: no knowledge article is published yet, its
  `effectiveDate` hasn't started, or the article's content genuinely isn't relevant to what was
  asked (the retriever now drops chunks below a minimum relevance score rather than handing the
  model something unrelated — see `packages/ai-core/src/retrieval/knowledge-retriever.ts`).
- **API won't start / "OPENAI_API_KEY is required"**: set a real key in `.env` — there's no mock
  fallback to fall back to anymore.
- **Suggested replies for agents are empty**: agent-side knowledge (`PUBLIC` + `AGENT_ONLY`
  audience) isn't relevant enough, or the request timed out.
