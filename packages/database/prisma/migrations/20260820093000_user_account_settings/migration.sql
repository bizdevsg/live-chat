-- CreateTable
CREATE TABLE `user_account_settings` (
    `user_id` VARCHAR(191) NOT NULL,
    `play_on_conversation_sound` BOOLEAN NOT NULL DEFAULT true,
    `play_new_messages_sound` BOOLEAN NOT NULL DEFAULT true,
    `on_conversation_sound` VARCHAR(191) NOT NULL DEFAULT 'ding-sound-effect',
    `new_messages_sound` VARCHAR(191) NOT NULL DEFAULT 'funny-laugh',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_account_settings` ADD CONSTRAINT `user_account_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

