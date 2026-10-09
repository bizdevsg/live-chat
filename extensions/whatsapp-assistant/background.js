const BUNDLED_ASSISTANT_KEY = "__WHATSAPP_ASSISTANT_KEY__";
const BUNDLED_API_BASE_URL = "__WHATSAPP_ASSISTANT_API_URL__";
const BUNDLED_SITE_ID = "__WHATSAPP_ASSISTANT_SITE_ID__";

const DEFAULT_SETTINGS = {
  autoReplyPrompt: "Balas pesan customer secara singkat, ramah, profesional, dan sesuai knowledge base.",
  autoReplyDelaySeconds: 6,
  autoReplyHourlyLimit: 10,
};

let bundledSystemPromptPromise;

function getBundledSystemPrompt() {
  bundledSystemPromptPromise ??= fetch(chrome.runtime.getURL("system-prompt.md"))
    .then((response) => {
      if (!response.ok) throw new Error("System prompt extension tidak ditemukan.");
      return response.text();
    })
    .then((prompt) => {
      const normalized = prompt.trim();
      if (!normalized) throw new Error("System prompt extension masih kosong.");
      return normalized;
    });
  return bundledSystemPromptPromise;
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  await chrome.storage.local.set({ ...DEFAULT_SETTINGS, ...stored });
  await chrome.storage.local.remove(["apiBaseUrl", "assistantKey", "siteId", "accessToken", "refreshToken"]);
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function bundledValue(value) {
  return value.startsWith("__") ? "" : value.trim();
}

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    apiBaseUrl: normalizeBaseUrl(bundledValue(BUNDLED_API_BASE_URL)),
    assistantKey: bundledValue(BUNDLED_ASSISTANT_KEY),
    siteId: bundledValue(BUNDLED_SITE_ID),
  };
}

async function parseResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(body?.error?.message || `Request gagal (${response.status}).`);
    error.status = response.status;
    error.code = body?.error?.code || "REQUEST_FAILED";
    throw error;
  }
  return body.data;
}

async function apiRequest(path, init = {}) {
  const settings = await getSettings();
  if (!settings.apiBaseUrl || !settings.assistantKey) throw new Error("Konfigurasi extension belum tersedia pada paket build.");
  const headers = {
    "Content-Type": "application/json",
    "X-WhatsApp-Assistant-Key": settings.assistantKey,
    ...(init.headers || {}),
  };
  const response = await fetch(`${settings.apiBaseUrl}${path}`, { ...init, headers });
  return parseResponse(response);
}

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_SETTINGS": {
      const settings = await getSettings();
      return {
        autoReplyPrompt: settings.autoReplyPrompt,
        autoReplyDelaySeconds: settings.autoReplyDelaySeconds,
        autoReplyHourlyLimit: settings.autoReplyHourlyLimit,
        configured: Boolean(settings.assistantKey),
      };
    }
    case "CHECK_CONNECTION":
      return apiRequest("/api/v1/whatsapp-assistant/status");
    case "ASSIST": {
      const settings = await getSettings();
      const systemPrompt = await getBundledSystemPrompt();
      return apiRequest("/api/v1/whatsapp-assistant/reply", {
        method: "POST",
        body: JSON.stringify({
          ...message.payload,
          siteId: settings.siteId || undefined,
          systemPrompt,
        }),
      });
    }
    default:
      throw new Error("Perintah extension tidak dikenali.");
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type || message.type.startsWith("AUTO_REPLY_")) return false;
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      sendResponse({ ok: false, error: error?.message || "Terjadi kesalahan." });
    });
  return true;
});
