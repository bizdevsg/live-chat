package com.solidchat.sdk

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SolidChatStateTest {
    @Test fun `production config uses the live widget API by default`() {
        val config = SolidChatConfig()
        kotlin.test.assertEquals("https://live-chat.sg-berjangka.com", config.apiUrl)
        kotlin.test.assertEquals("solid-gold-main", config.siteId)
        kotlin.test.assertEquals("id", config.language)
    }

    @Test fun `native session context leaves page url empty by default`() {
        kotlin.test.assertEquals(null, SolidChatSessionContext().pageUrl)
    }

    @Test fun `agent button follows widget eligibility`() {
        val site = SiteConfig("site", "Site", settings = SiteSettings(showAgentButton = true))
        val conversation = Conversation("conversation", "OPEN", "AI")
        val ai = ChatMessage("message", "conversation", "AI", "TEXT", "Halo", "2026-01-01T00:00:00Z")
        assertTrue(SolidChatState(site = site, conversation = conversation, messages = listOf(ai)).canRequestAgent)
        assertFalse(SolidChatState(site = site, conversation = conversation.copy(handlerType = "HUMAN"), messages = listOf(ai)).canRequestAgent)
        assertFalse(SolidChatState(site = site, conversation = conversation.copy(status = "CLOSED"), messages = listOf(ai)).canRequestAgent)
    }
}
