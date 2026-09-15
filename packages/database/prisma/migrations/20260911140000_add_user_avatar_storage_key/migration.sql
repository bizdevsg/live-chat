-- Adds a slot for the agent's profile photo. Stores a MinIO object key, never a public URL —
-- reads always go through a signed URL (§33). NULL until the agent uploads one; a re-upload
-- writes a fresh key, which the client also uses as its cache-bust key.
ALTER TABLE `users` ADD COLUMN `avatar_storage_key` VARCHAR(191) NULL AFTER `clara_user_id`;
