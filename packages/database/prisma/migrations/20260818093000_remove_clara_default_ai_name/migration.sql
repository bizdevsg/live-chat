-- The original init migration set `sites.ai_name` DEFAULT 'Clara'. `schema.prisma` was later
-- changed to default "Asisten Virtual" (matching DEFAULT_AI_NAME in ai.controller.ts), but that
-- edit was never turned into a migration, so the column default drifted and any site row created
-- before the edit (or relying on the column default rather than an explicit value) is still
-- stuck on "Clara". The AI's display name is meant to come entirely from AI Configuration
-- (site.aiName) — "Clara" should not be hardcoded/defaulted anywhere. This migration fixes both
-- the column default and any existing row still carrying the old default value.

ALTER TABLE `sites`
  ALTER COLUMN `ai_name` SET DEFAULT 'Asisten Virtual';

UPDATE `sites` SET `ai_name` = 'Asisten Virtual' WHERE `ai_name` = 'Clara';
