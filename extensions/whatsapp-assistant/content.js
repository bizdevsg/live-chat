(() => {
  if (globalThis.__solidChatAssistantContentLoaded) return;
  globalThis.__solidChatAssistantContentLoaded = true;

  const MAX_CONTEXT_MESSAGES = 50;
  const seenMessageIds = new Set();
  const autoReplyTimestamps = [];
  let activeChatKey = null;
  let initialized = false;
  let autoReplyEnabled = false;
  let autoReplyTimer = null;
  let autoReplyInFlight = false;
  let lastOutgoingId = null;
  let observer = null;
  let scanDebounce = null;

  function textFrom(node) {
    const wrappers = [...node.querySelectorAll("[data-pre-plain-text]")];
    const candidates = wrappers.length
      ? wrappers.flatMap((wrapper) => [...wrapper.querySelectorAll("[data-testid='selectable-text'], .selectable-text")])
      : [...node.querySelectorAll("[data-testid='selectable-text'], .selectable-text.copyable-text, .copyable-text .selectable-text")];
    const leafCandidates = candidates.filter(
      (element) => !element.querySelector("[data-testid='selectable-text'], .selectable-text"),
    );
    const parts = (leafCandidates.length ? leafCandidates : candidates)
      .map((element) => element.textContent?.trim())
      .filter(Boolean);
    return [...new Set(parts)].join("\n").trim();
  }

  function matchesOrContains(node, selector) {
    return node.matches(selector) || Boolean(node.querySelector(selector));
  }

  function senderTypeFrom(main, row, bubble) {
    if (matchesOrContains(bubble, "[aria-label='You:'], [aria-label='You :']")) return "AGENT";

    const dataId = row.getAttribute("data-id") || bubble.getAttribute("data-id") || "";
    if (/(?:^|_)true(?:_|$)/i.test(dataId)) return "AGENT";
    if (/(?:^|_)false(?:_|$)/i.test(dataId)) return "CUSTOMER";

    if (matchesOrContains(bubble, "[data-testid='tail-out'], [data-icon='tail-out']")) return "AGENT";
    if (matchesOrContains(bubble, "[data-testid='tail-in'], [data-icon='tail-in']")) return "CUSTOMER";
    if (bubble.classList.contains("message-out") || row.classList.contains("message-out")) return "AGENT";
    if (bubble.classList.contains("message-in") || row.classList.contains("message-in")) return "CUSTOMER";

    const senderLabel = [...bubble.querySelectorAll("[aria-label]")]
      .map((element) => element.getAttribute("aria-label")?.trim())
      .find((label) => label?.endsWith(":"));
    if (senderLabel) return /^you\s*:/i.test(senderLabel) ? "AGENT" : "CUSTOMER";

    const mainRect = main.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    if (mainRect.width > 0 && bubbleRect.width > 0) {
      const mainCenter = mainRect.left + mainRect.width / 2;
      const bubbleCenter = bubbleRect.left + bubbleRect.width / 2;
      return bubbleCenter >= mainCenter ? "AGENT" : "CUSTOMER";
    }

    // Incoming messages expose their sender in data-pre-plain-text. This is the
    // final fallback after every outgoing marker and the visual alignment check.
    if (bubble.querySelector("[data-pre-plain-text]")) return "CUSTOMER";
    return null;
  }

  function collectMessageRows(main) {
    const candidates = [
      ...main.querySelectorAll(
        "[data-testid^='conv-msg-'], [data-testid='msg-container'], .message-in, .message-out",
      ),
    ];
    const rows = [];
    const seen = new Set();
    for (const candidate of candidates) {
      const row =
        (candidate.matches("[data-testid^='conv-msg-']") && candidate) ||
        candidate.closest("[data-testid^='conv-msg-']") ||
        candidate.closest("[data-id]") ||
        candidate;
      if (seen.has(row)) continue;
      const bubble = row.matches("[data-testid='msg-container'], .message-in, .message-out")
        ? row
        : row.querySelector("[data-testid='msg-container'], .message-in, .message-out");
      if (!bubble) continue;
      seen.add(row);
      rows.push(row);
    }
    rows.sort((left, right) => {
      if (left === right) return 0;
      return left.compareDocumentPosition(right) & 4 ? -1 : 1;
    });
    return rows;
  }

  function messageId(node, senderType, content, index) {
    const explicit = node.getAttribute("data-id") || node.querySelector("[data-id]")?.getAttribute("data-id");
    if (explicit) return explicit;
    let hash = 0;
    const raw = `${senderType}:${content}:${index}`;
    for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) | 0;
    return `fallback:${hash}`;
  }

  function getConversationTitle(main) {
    const candidates = [
      "header [data-testid='conversation-info-header-chat-title']",
      "header span[title]",
      "header [dir='auto']",
    ];
    for (const selector of candidates) {
      const element = main.querySelector(selector);
      const title = element?.getAttribute("title") || element?.textContent;
      if (title?.trim()) return title.trim();
    }
    return "Chat aktif";
  }

  function scanConversation() {
    const main = document.querySelector("#main");
    if (!main) return { available: false, title: "Buka sebuah chat WhatsApp", messages: [] };

    const rows = collectMessageRows(main);
    const messages = [];
    const usedIds = new Set();
    for (const [index, row] of rows.entries()) {
      const bubble = row.matches("[data-testid='msg-container'], .message-in, .message-out")
        ? row
        : row.querySelector("[data-testid='msg-container'], .message-in, .message-out");
      if (!bubble) continue;
      const senderType = senderTypeFrom(main, row, bubble);
      if (!senderType) continue;
      const content = textFrom(bubble);
      if (!content) continue;
      const id = messageId(row, senderType, content, index);
      if (usedIds.has(id)) continue;
      usedIds.add(id);
      messages.push({ id, senderType, content, createdAt: new Date().toISOString() });
    }

    const limitedMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
    const latestCustomerMessage = [...limitedMessages].reverse().find((message) => message.senderType === "CUSTOMER");
    return {
      available: true,
      title: getConversationTitle(main),
      messages: limitedMessages,
      latestCustomerMessage: latestCustomerMessage
        ? { id: latestCustomerMessage.id, content: latestCustomerMessage.content }
        : null,
    };
  }

  function findComposer() {
    const selectors = [
      "#main footer [contenteditable='true'][role='textbox']",
      "#main footer [contenteditable='true'][data-tab]",
      "#main [contenteditable='true'][role='textbox']",
    ];
    return selectors.map((selector) => document.querySelector(selector)).find(Boolean) || null;
  }

  function composerHasDraft() {
    return Boolean(findComposer()?.textContent?.trim());
  }

  function insertDraft(text, replaceExisting = true) {
    const composer = findComposer();
    if (!composer) throw new Error("Kolom pesan WhatsApp tidak ditemukan.");
    if (!replaceExisting && composerHasDraft()) {
      throw new Error("Agent sedang mengetik. Auto-reply dibatalkan agar draft agent tidak tertimpa.");
    }
    composer.focus();
    if (replaceExisting) document.execCommand("selectAll", false);
    document.execCommand("insertText", false, text);
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return true;
  }

  function clickSend() {
    const selectors = [
      "#main footer [data-testid='compose-btn-send']",
      "#main footer button[aria-label='Send']",
      "#main footer button[aria-label='Kirim']",
      "#main footer span[data-icon='send']",
    ];
    const target = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
    const button = target?.closest("button") || target;
    if (!button) throw new Error("Tombol kirim WhatsApp tidak ditemukan.");
    button.click();
  }

  function cancelPendingAutoReply(reason) {
    if (autoReplyTimer) clearTimeout(autoReplyTimer);
    autoReplyTimer = null;
    if (reason) chrome.runtime.sendMessage({ type: "AUTO_REPLY_STATUS", payload: { status: "cancelled", message: reason } }).catch(() => undefined);
  }

  async function runAutoReply(context, incomingId, outgoingIdAtSchedule) {
    autoReplyTimer = null;
    if (!autoReplyEnabled || autoReplyInFlight) return;
    const latestContext = scanConversation();
    const latestIncoming = [...latestContext.messages].reverse().find((message) => message.senderType === "CUSTOMER");
    const latestOutgoing = [...latestContext.messages].reverse().find((message) => message.senderType === "AGENT");
    if (!latestIncoming || latestIncoming.id !== incomingId || (latestOutgoing?.id || null) !== outgoingIdAtSchedule) return;
    if (composerHasDraft()) {
      autoReplyEnabled = false;
      cancelPendingAutoReply("Agent sedang mengetik. Auto-reply dimatikan.");
      chrome.runtime.sendMessage({ type: "AUTO_REPLY_STATUS", payload: { status: "disabled", message: "Agent sedang mengetik. Auto-reply dimatikan.", disabled: true } }).catch(() => undefined);
      return;
    }

    const settings = await chrome.storage.local.get(["autoReplyPrompt", "autoReplyHourlyLimit"]);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    while (autoReplyTimestamps[0] && autoReplyTimestamps[0] < oneHourAgo) autoReplyTimestamps.shift();
    const hourlyLimit = Math.min(30, Math.max(1, Number(settings.autoReplyHourlyLimit) || 10));
    if (autoReplyTimestamps.length >= hourlyLimit) {
      autoReplyEnabled = false;
      chrome.runtime.sendMessage({ type: "AUTO_REPLY_BLOCKED", payload: { reason: "Batas auto-reply per jam tercapai.", disabled: true } }).catch(() => undefined);
      return;
    }

    autoReplyInFlight = true;
    chrome.runtime.sendMessage({ type: "AUTO_REPLY_STATUS", payload: { status: "thinking", message: "Menyusun jawaban dari knowledge base…" } }).catch(() => undefined);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ASSIST",
        payload: {
          conversationTitle: context.title,
          prompt: settings.autoReplyPrompt || "Balas secara singkat, ramah, dan profesional.",
          messages: latestContext.messages.map(({ senderType, content, createdAt }) => ({ senderType, content, createdAt })),
        },
      });
      if (!response?.ok) throw new Error(response?.error || "AI gagal membuat jawaban.");
      if (!response.data?.canAutoReply) {
        chrome.runtime.sendMessage({
          type: "AUTO_REPLY_BLOCKED",
          payload: { reason: response.data?.autoReplyBlockedReason || "Jawaban memerlukan pemeriksaan agent.", draft: response.data?.reply },
        }).catch(() => undefined);
        return;
      }

      const beforeSend = scanConversation();
      const currentOutgoing = [...beforeSend.messages].reverse().find((message) => message.senderType === "AGENT");
      if (!autoReplyEnabled || (currentOutgoing?.id || null) !== outgoingIdAtSchedule) return;
      insertDraft(response.data.reply, false);
      clickSend();
      autoReplyTimestamps.push(Date.now());
      chrome.runtime.sendMessage({ type: "AUTO_REPLY_SENT", payload: { reply: response.data.reply } }).catch(() => undefined);
    } catch (error) {
      autoReplyEnabled = false;
      chrome.runtime.sendMessage({ type: "AUTO_REPLY_BLOCKED", payload: { reason: error?.message || "Auto-reply gagal.", disabled: true } }).catch(() => undefined);
    } finally {
      autoReplyInFlight = false;
    }
  }

  async function processScan() {
    const context = scanConversation();
    const chatKey = context.available ? context.title : null;
    if (chatKey !== activeChatKey) {
      activeChatKey = chatKey;
      autoReplyEnabled = false;
      cancelPendingAutoReply();
      seenMessageIds.clear();
      initialized = false;
    }

    const outgoing = [...context.messages].reverse().find((message) => message.senderType === "AGENT");
    if (initialized && outgoing?.id && outgoing.id !== lastOutgoingId) {
      autoReplyEnabled = false;
      cancelPendingAutoReply("Agent mengambil alih percakapan. Auto-reply dimatikan.");
      chrome.runtime.sendMessage({ type: "AUTO_REPLY_STATUS", payload: { status: "disabled", message: "Agent mengambil alih percakapan. Auto-reply dimatikan.", disabled: true } }).catch(() => undefined);
    }
    lastOutgoingId = outgoing?.id || null;

    if (!initialized) {
      context.messages.forEach((message) => seenMessageIds.add(message.id));
      initialized = true;
      return;
    }

    const newIncoming = context.messages.filter((message) => message.senderType === "CUSTOMER" && !seenMessageIds.has(message.id));
    context.messages.forEach((message) => seenMessageIds.add(message.id));
    const latestIncoming = newIncoming.at(-1);
    if (!autoReplyEnabled || !latestIncoming) return;

    cancelPendingAutoReply();
    const settings = await chrome.storage.local.get(["autoReplyDelaySeconds"]);
    const delayMs = Math.min(60, Math.max(3, Number(settings.autoReplyDelaySeconds) || 6)) * 1000;
    const outgoingIdAtSchedule = outgoing?.id || null;
    chrome.runtime.sendMessage({ type: "AUTO_REPLY_STATUS", payload: { status: "scheduled", message: `Auto-reply dalam ${delayMs / 1000} detik…` } }).catch(() => undefined);
    autoReplyTimer = setTimeout(() => runAutoReply(context, latestIncoming.id, outgoingIdAtSchedule), delayMs);
  }

  function scheduleScan() {
    if (scanDebounce) clearTimeout(scanDebounce);
    scanDebounce = setTimeout(processScan, 350);
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    scheduleScan();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      if (message?.type === "GET_CONTEXT") sendResponse({ ok: true, data: scanConversation() });
      else if (message?.type === "INSERT_DRAFT") sendResponse({ ok: true, data: insertDraft(message.text || "") });
      else if (message?.type === "SET_AUTO_REPLY") {
        autoReplyEnabled = Boolean(message.enabled);
        if (!autoReplyEnabled) cancelPendingAutoReply();
        sendResponse({ ok: true, data: { enabled: autoReplyEnabled } });
      } else if (message?.type === "GET_AUTO_REPLY_STATE") {
        sendResponse({ ok: true, data: { enabled: autoReplyEnabled, chat: activeChatKey } });
      } else return false;
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "WhatsApp Web tidak dapat diakses." });
    }
    return true;
  });

  startObserver();
})();
