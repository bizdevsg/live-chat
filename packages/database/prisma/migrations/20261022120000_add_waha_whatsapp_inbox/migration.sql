-- Add channel delivery metadata to messages.
ALTER TABLE `messages`
  ADD COLUMN `external_message_id` VARCHAR(191) NULL,
  ADD COLUMN `delivery_status` VARCHAR(191) NULL;

CREATE INDEX `messages_external_message_id_idx` ON `messages`(`external_message_id`);

-- One WAHA session/WhatsApp number per SolidChat organization.
CREATE TABLE `whatsapp_connections` (
  `id` VARCHAR(191) NOT NULL,
  `organization_id` VARCHAR(191) NOT NULL,
  `site_id` VARCHAR(191) NOT NULL,
  `session_name` VARCHAR(191) NOT NULL,
  `phone_number` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DISCONNECTED',
  `engine` VARCHAR(191) NOT NULL DEFAULT 'NOWEB',
  `last_error` TEXT NULL,
  `connected_at` DATETIME(3) NULL,
  `last_seen_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `whatsapp_connections_organization_id_key`(`organization_id`),
  UNIQUE INDEX `whatsapp_connections_session_name_key`(`session_name`),
  INDEX `whatsapp_connections_site_id_idx`(`site_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_conversations` (
  `id` VARCHAR(191) NOT NULL,
  `connection_id` VARCHAR(191) NOT NULL,
  `conversation_id` VARCHAR(191) NOT NULL,
  `chat_id` VARCHAR(191) NOT NULL,
  `contact_name` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `whatsapp_conversations_conversation_id_key`(`conversation_id`),
  INDEX `whatsapp_conversations_connection_id_chat_id_idx`(`connection_id`, `chat_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `whatsapp_connections`
  ADD CONSTRAINT `whatsapp_connections_organization_id_fkey`
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `whatsapp_connections_site_id_fkey`
  FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `whatsapp_conversations`
  ADD CONSTRAINT `whatsapp_conversations_connection_id_fkey`
  FOREIGN KEY (`connection_id`) REFERENCES `whatsapp_connections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `whatsapp_conversations_conversation_id_fkey`
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
