"use client";

export type DashboardNotification = {
  type?: string;
  title?: string;
  body?: string;
  conversationId?: string;
};

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserNotificationPermission() {
  if (getBrowserNotificationPermission() === "unsupported") return "unsupported" as const;
  return Notification.requestPermission();
}

export function showBrowserNotification(notification: DashboardNotification) {
  if (getBrowserNotificationPermission() !== "granted" || document.visibilityState === "visible") return;

  try {
    const browserNotification = new Notification(notification.title ?? "Notifikasi chat baru", {
      body: notification.body,
      tag: notification.conversationId ? `conversation:${notification.conversationId}` : notification.type,
    });
    browserNotification.onclick = () => {
      window.focus();
      browserNotification.close();
    };
  } catch {
    // Some browser contexts expose Notification but disallow construction.
  }
}
