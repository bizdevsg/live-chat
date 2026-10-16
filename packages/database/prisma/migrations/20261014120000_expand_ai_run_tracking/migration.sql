ALTER TABLE `ai_runs`
  ADD COLUMN `organization_id` VARCHAR(191) NULL,
  ADD COLUMN `site_id` VARCHAR(191) NULL,
  ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'CHAT',
  MODIFY `conversation_id` VARCHAR(191) NULL;

UPDATE `ai_runs` AS `run`
INNER JOIN `conversations` AS `conversation` ON `conversation`.`id` = `run`.`conversation_id`
SET
  `run`.`organization_id` = `conversation`.`organization_id`,
  `run`.`site_id` = `conversation`.`site_id`;

ALTER TABLE `ai_runs`
  MODIFY `organization_id` VARCHAR(191) NOT NULL,
  ADD CONSTRAINT `ai_runs_organization_id_fkey`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ai_runs_site_id_fkey`
    FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD INDEX `ai_runs_organization_id_created_at_idx` (`organization_id`, `created_at`),
  ADD INDEX `ai_runs_site_id_created_at_idx` (`site_id`, `created_at`),
  ADD INDEX `ai_runs_source_created_at_idx` (`source`, `created_at`);
