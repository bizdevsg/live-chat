-- Store one administrator-selected chat model for all AI conversation tasks.
ALTER TABLE `ai_configurations`
  ADD COLUMN `model` VARCHAR(191) NOT NULL DEFAULT 'gpt-4o-mini' AFTER `provider`;
