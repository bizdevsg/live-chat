ALTER TABLE `site_settings`
  ADD COLUMN `agent_button_label` VARCHAR(191) NOT NULL DEFAULT 'Hubungi Agent Kami' AFTER `show_agent_button`;
