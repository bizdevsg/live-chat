const VISITOR_ID_KEY = "solidchat_visitor_id";
const VISITOR_TOKEN_KEY = "solidchat_visitor_token";
const CONVERSATION_ID_KEY = "solidchat_conversation_id";

function randomId(): string {
  return `visitor_${crypto.randomUUID()}`;
}

/** First-party localStorage on the widget's own origin (the iframe domain) — never the parent site's storage. */
export const widgetStorage = {
  getOrCreateVisitorId(): string {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  },
  getVisitorToken: () => sessionStorage.getItem(VISITOR_TOKEN_KEY),
  setVisitorToken: (token: string) => sessionStorage.setItem(VISITOR_TOKEN_KEY, token),
  getConversationId: () => localStorage.getItem(CONVERSATION_ID_KEY),
  setConversationId: (id: string) => localStorage.setItem(CONVERSATION_ID_KEY, id),
  reset() {
    localStorage.removeItem(VISITOR_ID_KEY);
    localStorage.removeItem(CONVERSATION_ID_KEY);
    sessionStorage.removeItem(VISITOR_TOKEN_KEY);
  },
};
