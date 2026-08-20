"use client";

import { create } from "zustand";

interface ConversationRealtimeState {
  activeConversationId: string | null;
  unreadByConversationId: Record<string, boolean>;
  setActiveConversation: (conversationId: string | null) => void;
  markUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
  reset: () => void;
}

export const useConversationRealtimeStore = create<ConversationRealtimeState>((set) => ({
  activeConversationId: null,
  unreadByConversationId: {},
  setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),
  markUnread: (conversationId) =>
    set((state) => ({
      unreadByConversationId: { ...state.unreadByConversationId, [conversationId]: true },
    })),
  clearUnread: (conversationId) =>
    set((state) => {
      if (!state.unreadByConversationId[conversationId]) return state;

      const nextUnreadByConversationId = { ...state.unreadByConversationId };
      delete nextUnreadByConversationId[conversationId];
      return { unreadByConversationId: nextUnreadByConversationId };
    }),
  reset: () => set({ activeConversationId: null, unreadByConversationId: {} }),
}));
