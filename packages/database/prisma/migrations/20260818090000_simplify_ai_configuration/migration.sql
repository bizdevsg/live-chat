-- Simplify ai_configurations: per-purpose model names, confidence threshold, and
-- retry/timeout/token limits are now fixed application constants (see AI_MODELS,
-- DEFAULT_CONFIDENCE_THRESHOLD, AI_MAX_OUTPUT_TOKENS, AI_TIMEOUT_MS, AI_MAX_RETRIES in
-- packages/shared/src/constants.ts) instead of per-row DB configuration nobody varied.
-- `provider` is kept but the app now always builds the OpenAI provider — there is no
-- mock/dummy AI mode anymore, so existing rows are normalized to "openai".

UPDATE `ai_configurations` SET `provider` = 'openai' WHERE `provider` != 'openai';

ALTER TABLE `ai_configurations`
  DROP COLUMN `classifier_model`,
  DROP COLUMN `answer_model`,
  DROP COLUMN `summary_model`,
  DROP COLUMN `suggested_reply_model`,
  DROP COLUMN `embedding_model`,
  DROP COLUMN `confidence_threshold`,
  DROP COLUMN `max_tokens`,
  DROP COLUMN `timeout_ms`,
  DROP COLUMN `max_retries`;

ALTER TABLE `ai_configurations`
  ALTER COLUMN `provider` SET DEFAULT 'openai';
