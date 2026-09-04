-- One active chat per agent by default (§26 routing).
-- Existing profiles are normalized to 1; admins can raise an individual agent's
-- limit again afterwards.
ALTER TABLE `agent_profiles` MODIFY `max_concurrent_chats` INTEGER NOT NULL DEFAULT 1;

UPDATE `agent_profiles` SET `max_concurrent_chats` = 1;
