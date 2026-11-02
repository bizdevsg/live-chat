-- Remove the WAHA WhatsApp inbox (tables and message delivery metadata).
DROP TABLE `whatsapp_conversations`;
DROP TABLE `whatsapp_connections`;

DROP INDEX `messages_external_message_id_idx` ON `messages`;
ALTER TABLE `messages`
  DROP COLUMN `external_message_id`,
  DROP COLUMN `delivery_status`;
