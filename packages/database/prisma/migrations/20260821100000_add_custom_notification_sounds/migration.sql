ALTER TABLE `user_account_settings`
  ADD COLUMN `custom_on_conversation_sound_name` VARCHAR(191) NULL,
  ADD COLUMN `custom_on_conversation_sound_storage_key` VARCHAR(191) NULL,
  ADD COLUMN `custom_new_messages_sound_name` VARCHAR(191) NULL,
  ADD COLUMN `custom_new_messages_sound_storage_key` VARCHAR(191) NULL;
