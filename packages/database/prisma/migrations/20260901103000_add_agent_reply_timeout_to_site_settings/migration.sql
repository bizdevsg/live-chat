ALTER TABLE `site_settings`
  ADD COLUMN `agent_reply_timeout_seconds` INTEGER NOT NULL DEFAULT 60 AFTER `rating_form_enabled`;
