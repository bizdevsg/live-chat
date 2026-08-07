export interface WidgetContext {
  pageType?: string;
  campaign?: string;
  product?: string;
}

type ParentMessage =
  | { type: "solidchat:open" }
  | { type: "solidchat:close" }
  | { type: "solidchat:context"; context: WidgetContext }
  | { type: "solidchat:identify"; identityToken: string }
  | { type: "solidchat:reset" };

type ChildMessage =
  | { type: "solidchat:ready" }
  | { type: "solidchat:resize"; height: number }
  | { type: "solidchat:request-close" }
  | { type: "solidchat:unread"; count: number };

/**
 * The iframe only trusts postMessage events whose origin matches the page that embedded it
 * (captured once via document.referrer at load time), per §7's origin-validation requirement.
 */
function getExpectedParentOrigin(): string | null {
  try {
    return document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    return null;
  }
}

export function listenToParent(onMessage: (msg: ParentMessage) => void): () => void {
  const expectedOrigin = getExpectedParentOrigin();
  const handler = (event: MessageEvent) => {
    if (expectedOrigin && event.origin !== expectedOrigin) return;
    const data = event.data as ParentMessage | undefined;
    if (data && typeof data === "object" && typeof data.type === "string" && data.type.startsWith("solidchat:")) {
      onMessage(data);
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

export function sendToParent(message: ChildMessage): void {
  const expectedOrigin = getExpectedParentOrigin();
  if (!window.parent || window.parent === window) return;
  window.parent.postMessage(message, expectedOrigin ?? "*");
}
