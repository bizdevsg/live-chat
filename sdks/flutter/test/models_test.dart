import 'package:flutter_test/flutter_test.dart';
import 'package:solidchat_flutter/solidchat_flutter.dart';

void main() {
  test('production config works without host configuration', () {
    const config = SolidChatConfig();

    expect(config.apiUrl, solidChatProductionApiUrl);
    expect(config.siteId, solidChatSolidGoldSiteId);
    expect(config.language, 'id');
  });

  test('site settings use safe defaults for missing fields', () {
    final site = SiteConfig.fromJson({'siteId': 'site-1', 'name': 'Support'});

    expect(site.settings.preChatFormEnabled, isTrue);
    expect(site.settings.humanChatEnabled, isTrue);
    expect(site.widgetColor, '#D4AF37');
  });

  test('state enables agent request after an AI response', () {
    const conversation = Conversation(
      id: 'conversation-1',
      status: 'OPEN',
      handlerType: 'AI',
    );
    const message = ChatMessage(
      id: 'message-1',
      conversationId: 'conversation-1',
      senderType: 'AI',
      messageType: 'TEXT',
      content: 'Halo',
      createdAt: '2026-10-08T00:00:00.000Z',
    );
    const state = SolidChatState(
      site: SiteConfig(siteId: 'site-1', name: 'Support'),
      conversation: conversation,
      messages: [message],
    );

    expect(state.canRequestAgent, isTrue);
  });

  test('agent handoff state matches website countdown behavior', () {
    const state = SolidChatState(
      site: SiteConfig(siteId: 'site-1', name: 'Support'),
      conversation: Conversation(
        id: 'conversation-1',
        status: 'QUEUED',
        handlerType: 'PENDING',
      ),
      agentRequested: true,
      agentReplyRemainingSeconds: 0,
      messages: [
        ChatMessage(
          id: 'message-1',
          conversationId: 'conversation-1',
          senderType: 'AI',
          messageType: 'TEXT',
          content: 'Halo',
          createdAt: '2026-10-08T00:00:00.000Z',
        ),
      ],
    );

    expect(state.agentConnecting, isTrue);
    expect(state.agentReplyTimedOut, isTrue);
    expect(state.canRequestAgent, isTrue);
  });
}
