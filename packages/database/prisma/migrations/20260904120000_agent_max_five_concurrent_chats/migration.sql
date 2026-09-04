-- Agents may handle up to 5 concurrent chats (reverses 20260903120000_agent_single_chat_default).
-- The default covers new profiles; the UPDATE lifts every existing agent to the new ceiling.
ALTER TABLE `agent_profiles` MODIFY `max_concurrent_chats` INTEGER NOT NULL DEFAULT 5;

UPDATE `agent_profiles` SET `max_concurrent_chats` = 5;
