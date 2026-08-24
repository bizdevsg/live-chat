const VISITOR_ID_KEY = "solidchat_visitor_id";
const VISITOR_TOKEN_KEY = "solidchat_visitor_token";
const CONVERSATION_ID_KEY = "solidchat_conversation_id";
const LEAD_CONVERSATION_ID_KEY = "solidchat_lead_conversation_id";
const TICKET_INFO_KEY = "solidchat_ticket_info";

interface StoredTicketInfo {
  conversationId: string;
  ticketNumber: string;
}

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
  clearConversationId: () => localStorage.removeItem(CONVERSATION_ID_KEY),
  getLeadConversationId: () => sessionStorage.getItem(LEAD_CONVERSATION_ID_KEY),
  setLeadConversationId: (id: string) => sessionStorage.setItem(LEAD_CONVERSATION_ID_KEY, id),
  clearLeadConversationId: () => sessionStorage.removeItem(LEAD_CONVERSATION_ID_KEY),
  getTicketInfo(): StoredTicketInfo | null {
    const raw = sessionStorage.getItem(TICKET_INFO_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredTicketInfo;
    } catch {
      return null;
    }
  },
  setTicketInfo: (info: StoredTicketInfo) => sessionStorage.setItem(TICKET_INFO_KEY, JSON.stringify(info)),
  clearTicketInfo: () => sessionStorage.removeItem(TICKET_INFO_KEY),
  reset() {
    localStorage.removeItem(VISITOR_ID_KEY);
    localStorage.removeItem(CONVERSATION_ID_KEY);
    sessionStorage.removeItem(VISITOR_TOKEN_KEY);
    sessionStorage.removeItem(LEAD_CONVERSATION_ID_KEY);
    sessionStorage.removeItem(TICKET_INFO_KEY);
  },
};
