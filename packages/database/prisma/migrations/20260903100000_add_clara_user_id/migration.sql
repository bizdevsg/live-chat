-- Adds the stable Clara SSO identity (`sub`) for agents, per "Kebutuhan API Live Chat dan SSO
-- Dashboard untuk Integrasi Clara" v1.1 §4A.1 and §11. Populated only once Clara SSO login
-- ships; NULL until then, and never derived from name/email.
ALTER TABLE `users` ADD COLUMN `clara_user_id` VARCHAR(191) NULL AFTER `supervisor_id`;

CREATE UNIQUE INDEX `users_clara_user_id_key` ON `users`(`clara_user_id`);
