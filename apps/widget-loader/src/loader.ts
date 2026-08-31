/**
 * SolidChat widget.js — lightweight loader injected into the Solid Gold website (§7).
 * Responsibilities: read config from the <script> tag, render an isolated floating bubble,
 * lazily inject the chat iframe on first open, and bridge postMessage between the host page
 * and the iframe with strict origin checks on both sides.
 */

type SolidChatContext = {
  pageType?: string;
  campaign?: string;
  product?: string;
};

interface SolidChatApi {
  open(): void;
  close(): void;
  toggle(): void;
  identify(identityToken: string): void;
  setContext(context: SolidChatContext): void;
  reset(): void;
}

declare global {
  interface Window {
    SolidChat?: SolidChatApi;
  }
}

const FLOATING_BOTTOM_OFFSET = 40;
const PANEL_BOTTOM_OFFSET = FLOATING_BOTTOM_OFFSET;

function supportsRequiredFeatures(): boolean {
  return (
    typeof window.postMessage === "function" &&
    typeof window.fetch === "function" &&
    typeof window.Promise === "function" &&
    "attachShadow" in Element.prototype
  );
}

function readConfig(script: HTMLOrSVGScriptElement & HTMLElement) {
  return {
    siteId: script.dataset.siteId ?? "",
    apiUrl: script.dataset.apiUrl ?? __API_URL__,
    position:
      script.dataset.position === "bottom-left"
        ? "bottom-left"
        : "bottom-right",
    language: script.dataset.language ?? "id",
  };
}

function currentScript(): HTMLScriptElement | null {
  const el = document.currentScript;
  if (el instanceof HTMLScriptElement) return el;
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    "script[data-site-id]",
  );
  return scripts.length > 0 ? scripts[scripts.length - 1]! : null;
}

function init() {
  if (window.SolidChat) return; // idempotent — avoid double init if the snippet is included twice
  if (!supportsRequiredFeatures()) return;

  const script = currentScript();
  if (!script) return;
  const config = readConfig(script);
  const widgetOrigin = new URL(script.src || __WIDGET_URL__, window.location.href).origin;
  if (!config.siteId) {
    console.warn(
      "[SolidChat] data-site-id is required on the widget.js <script> tag.",
    );
    return;
  }

  const host = document.createElement("div");
  host.id = "solidchat-widget-host";
  host.style.position = "fixed";
  host.style.zIndex = "2147483000";
  host.style.bottom = "0";
  host.style[config.position === "bottom-left" ? "left" : "right"] = "0";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .bubble { position: fixed; bottom: ${FLOATING_BOTTOM_OFFSET}px; ${config.position === "bottom-left" ? "left: 20px;" : "right: 20px;"}
      width: 88px; height: 88px; border: none; cursor: pointer; padding: 0;
      background: transparent; color: #0b0b0c; font-size: 26px; box-shadow: none;
      display: flex; align-items: center; justify-content: center; transition: transform .15s ease; }
    .bubble:hover { transform: scale(1.05); }
    .bubble.has-unread { filter: drop-shadow(0 0 14px rgba(229,72,77,.45)); }
    .bubble-image { width: 100%; height: 100%; display: block; object-fit: contain; }
    .bubble.open { display: none; }
    .badge { position: fixed; bottom: ${FLOATING_BOTTOM_OFFSET + 42}px; ${config.position === "bottom-left" ? "left: 62px;" : "right: 62px;"}
      min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; background: #e5484d;
      color: #fff; font: 600 11px/20px system-ui, sans-serif; text-align: center; display: none; }
    .badge.visible { display: block; animation: badge-pulse 1.8s ease-out infinite; }
    @keyframes badge-pulse {
      0% { box-shadow: 0 0 0 0 rgba(229,72,77,.45); }
      70% { box-shadow: 0 0 0 10px rgba(229,72,77,0); }
      100% { box-shadow: 0 0 0 0 rgba(229,72,77,0); }
    }
    .panel { position: fixed; bottom: ${PANEL_BOTTOM_OFFSET}px; ${config.position === "bottom-left" ? "left: 20px;" : "right: 20px;"}
      width: 370px; height: 560px; max-height: calc(100vh - 120px); border: none; border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,.45); display: none; background: #0b0b0c; }
    .panel.open { display: block; }
    @media (max-width: 480px) {
      .panel { width: 100vw; height: 100vh; max-height: 100vh; bottom: 0; right: 0; left: 0; border-radius: 0; }
    }
  `;
  shadow.appendChild(style);

  const bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.setAttribute("aria-label", "Buka live chat");
  const bubbleImage = document.createElement("img");
  bubbleImage.className = "bubble-image";
  bubbleImage.src = `${widgetOrigin}/live-bubble.png`;
  bubbleImage.alt = "";
  bubbleImage.setAttribute("aria-hidden", "true");
  bubbleImage.setAttribute("draggable", "false");
  bubble.appendChild(bubbleImage);

  shadow.appendChild(bubble);

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.setAttribute("aria-hidden", "true");
  shadow.appendChild(badge);

  let iframe: HTMLIFrameElement | null = null;
  let isOpen = false;
  let pendingContext: SolidChatContext | null = null;
  let pendingIdentity: string | null = null;

  function setUnreadBadge(count: number) {
    if (isOpen || count <= 0) {
      badge.classList.remove("visible");
      bubble.classList.remove("has-unread");
      bubble.setAttribute("aria-label", "Buka live chat");
      return;
    }
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.classList.add("visible");
    bubble.classList.add("has-unread");
    bubble.setAttribute("aria-label", `Buka live chat, ${count} pesan baru`);
  }

  function ensureIframe(): HTMLIFrameElement {
    if (iframe) return iframe;
    iframe = document.createElement("iframe");
    iframe.className = "panel";
    iframe.title = "SolidChat AI Live Chat";
    iframe.setAttribute("allow", "clipboard-write");
    const params = new URLSearchParams({
      siteId: config.siteId,
      apiUrl: config.apiUrl,
      language: config.language,
    });
    iframe.src = `${widgetOrigin}/?${params.toString()}`;
    shadow.appendChild(iframe);
    return iframe;
  }

  function postToIframe(message: unknown) {
    iframe?.contentWindow?.postMessage(message, widgetOrigin);
  }

  function open() {
    const frame = ensureIframe();
    frame.classList.add("open");
    isOpen = true;
    bubble.classList.add("open");
    setUnreadBadge(0);
    postToIframe({ type: "solidchat:open" });
    if (pendingContext)
      postToIframe({ type: "solidchat:context", context: pendingContext });
    if (pendingIdentity)
      postToIframe({
        type: "solidchat:identify",
        identityToken: pendingIdentity,
      });
  }

  function close() {
    iframe?.classList.remove("open");
    isOpen = false;
    bubble.classList.remove("open");
    postToIframe({ type: "solidchat:close" });
  }

  bubble.addEventListener("click", () => (isOpen ? close() : open()));

  function onMessage(event: MessageEvent) {
    if (event.origin !== widgetOrigin) return; // only trust our own iframe's origin
    if (!iframe || event.source !== iframe.contentWindow) return;
    const data = event.data as
      { type?: string; height?: number; count?: number } | undefined;
    if (!data || typeof data.type !== "string") return;

    if (data.type === "solidchat:request-close") close();
    if (
      data.type === "solidchat:resize" &&
      typeof data.height === "number" &&
      iframe
    ) {
      iframe.style.height = `${Math.min(data.height, window.innerHeight - 120)}px`;
    }
    if (data.type === "solidchat:unread" && typeof data.count === "number") {
      setUnreadBadge(data.count);
    }
  }
  window.addEventListener("message", onMessage);

  window.SolidChat = {
    open,
    close,
    toggle: () => (isOpen ? close() : open()),
    identify: (identityToken: string) => {
      pendingIdentity = identityToken;
      if (isOpen) postToIframe({ type: "solidchat:identify", identityToken });
    },
    setContext: (context: SolidChatContext) => {
      pendingContext = context;
      if (isOpen) postToIframe({ type: "solidchat:context", context });
    },
    reset: () => {
      pendingContext = null;
      pendingIdentity = null;
      if (iframe) {
        iframe.remove();
        iframe = null;
      }
      close();
      setUnreadBadge(0);
    },
  };

  window.addEventListener(
    "pagehide",
    () => {
      window.removeEventListener("message", onMessage);
    },
    { once: true },
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
