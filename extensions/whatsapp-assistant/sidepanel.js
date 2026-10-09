const elements = {
  connectionBadge: document.querySelector("#connectionBadge"),
  chatTitle: document.querySelector("#chatTitle"),
  messageCount: document.querySelector("#messageCount"),
  autoReplyToggle: document.querySelector("#autoReplyToggle"),
  autoStatus: document.querySelector("#autoStatus"),
  assistantMessages: document.querySelector("#assistantMessages"),
  promptInput: document.querySelector("#promptInput"),
  askButton: document.querySelector("#askButton"),
};

let configured = false;
let currentContext = null;
let lastAssistantReply = "";
let typingIndicator = null;

async function runtimeMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "Extension tidak merespons.");
  return response.data;
}

async function activeWhatsAppTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url?.startsWith("https://web.whatsapp.com/")) return null;
  return tab;
}

async function tabMessage(message) {
  const tab = await activeWhatsAppTab();
  if (!tab) throw new Error("Buka tab WhatsApp Web untuk memakai assistant.");
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    const missingReceiver = String(error?.message || error).includes("Receiving end does not exist");
    if (!missingReceiver) throw error;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    response = await chrome.tabs.sendMessage(tab.id, message);
  }
  if (!response?.ok) throw new Error(response?.error || "Chat WhatsApp belum siap.");
  return response.data;
}

function setConfigured(value) {
  configured = value;
  elements.connectionBadge.textContent = value ? "Terhubung" : "Koneksi bermasalah";
  elements.connectionBadge.classList.toggle("online", value);
}

function addMessage(role, text, metadata = {}) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(paragraph);

  if (metadata.sources?.length || metadata.confidence !== undefined) {
    const meta = document.createElement("div");
    meta.className = "message-meta";
    const sourceNames = metadata.sources?.map((source) => source.title).filter(Boolean).join(", ");
    meta.textContent = [
      metadata.confidence !== undefined ? `Confidence ${Math.round(metadata.confidence * 100)}%` : "",
      sourceNames ? `Knowledge: ${sourceNames}` : "",
    ].filter(Boolean).join(" · ");
    article.append(meta);
  }

  if (role === "assistant" && metadata.insertable !== false) {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const insert = document.createElement("button");
    insert.type = "button";
    insert.textContent = "Masukkan ke WhatsApp";
    insert.addEventListener("click", () => tabMessage({ type: "INSERT_DRAFT", text }).catch((error) => addMessage("error", error.message, { insertable: false })));
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Salin";
    copy.addEventListener("click", () => navigator.clipboard.writeText(text));
    actions.append(insert, copy);
    article.append(actions);
  }

  elements.assistantMessages.append(article);
  article.scrollIntoView({ behavior: "smooth", block: "end" });
}

function showTypingIndicator() {
  if (typingIndicator) return;
  const article = document.createElement("article");
  article.className = "message assistant typing";
  article.setAttribute("role", "status");
  article.setAttribute("aria-label", "AI sedang mengetik");

  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.setAttribute("aria-hidden", "true");
  dots.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
  article.append(dots);

  typingIndicator = article;
  elements.assistantMessages.append(article);
  article.scrollIntoView({ behavior: "smooth", block: "end" });
}

function hideTypingIndicator() {
  typingIndicator?.remove();
  typingIndicator = null;
}

async function refreshContext() {
  try {
    currentContext = await tabMessage({ type: "GET_CONTEXT" });
    elements.chatTitle.textContent = currentContext.title;
    elements.messageCount.textContent = `${currentContext.messages.length} pesan`;
    const state = await tabMessage({ type: "GET_AUTO_REPLY_STATE" });
    elements.autoReplyToggle.checked = Boolean(state.enabled);
  } catch {
    currentContext = null;
    elements.chatTitle.textContent = "Buka sebuah chat WhatsApp";
    elements.messageCount.textContent = "0 pesan";
    elements.autoReplyToggle.checked = false;
  }
}

async function connectAutomatically() {
  const settings = await runtimeMessage({ type: "GET_SETTINGS" });
  if (!settings.configured) throw new Error("Paket extension belum memiliki konfigurasi koneksi.");
  await runtimeMessage({ type: "CHECK_CONNECTION" });
  setConfigured(true);
}

async function askAssistant(promptOverride) {
  const prompt = String(promptOverride || elements.promptInput.value).trim();
  if (!prompt) return;
  if (!configured) throw new Error("Layanan AI belum terhubung. Coba buka ulang extension.");
  const context = await tabMessage({ type: "GET_CONTEXT" });
  if (!context.available || !context.messages.length) throw new Error("Buka chat WhatsApp yang memiliki pesan.");

  addMessage("user", prompt, { insertable: false });
  elements.promptInput.value = "";
  elements.askButton.disabled = true;
  showTypingIndicator();
  const instruction = lastAssistantReply
    ? `${prompt}\n\nDraft sebelumnya (gunakan hanya jika instruksi merujuk pada jawaban sebelumnya):\n${lastAssistantReply}`
    : prompt;
  try {
    const result = await runtimeMessage({
      type: "ASSIST",
      payload: {
        conversationTitle: context.title,
        prompt: instruction,
        messages: context.messages.map(({ senderType, content, createdAt }) => ({ senderType, content, createdAt })),
      },
    });
    lastAssistantReply = result.reply;
    hideTypingIndicator();
    addMessage("assistant", result.reply, { confidence: result.confidence, sources: result.sources });
  } finally {
    hideTypingIndicator();
    elements.askButton.disabled = false;
  }
}

elements.askButton.addEventListener("click", () => askAssistant().catch((error) => addMessage("error", error.message, { insertable: false })));
elements.promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    askAssistant().catch((error) => addMessage("error", error.message, { insertable: false }));
  }
});
document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => {
  elements.promptInput.value = button.dataset.prompt || "";
  elements.promptInput.focus();
}));
elements.autoReplyToggle.addEventListener("change", async () => {
  try {
    if (elements.autoReplyToggle.checked && !configured) throw new Error("Layanan AI belum terhubung. Coba buka ulang extension.");
    const result = await tabMessage({ type: "SET_AUTO_REPLY", enabled: elements.autoReplyToggle.checked });
    elements.autoReplyToggle.checked = result.enabled;
    elements.autoStatus.textContent = result.enabled ? "Auto-reply aktif untuk chat ini." : "Auto-reply nonaktif.";
  } catch (error) {
    elements.autoReplyToggle.checked = false;
    elements.autoStatus.textContent = error.message;
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "AUTO_REPLY_STATUS") {
    elements.autoStatus.textContent = message.payload?.message || "Auto-reply bekerja…";
    if (message.payload?.disabled) elements.autoReplyToggle.checked = false;
  }
  if (message?.type === "AUTO_REPLY_SENT") {
    elements.autoStatus.textContent = "Auto-reply berhasil dikirim.";
    if (message.payload?.reply) addMessage("assistant", message.payload.reply, { insertable: false });
  }
  if (message?.type === "AUTO_REPLY_BLOCKED") {
    elements.autoStatus.textContent = `Tidak dikirim otomatis: ${message.payload?.reason || "perlu review"}`;
    if (message.payload?.disabled) elements.autoReplyToggle.checked = false;
    if (message.payload?.draft) addMessage("assistant", message.payload.draft);
  }
});

connectAutomatically().catch((error) => {
  setConfigured(false);
  addMessage("error", `Koneksi otomatis gagal: ${error.message}`, { insertable: false });
});
refreshContext();
setInterval(refreshContext, 2000);
