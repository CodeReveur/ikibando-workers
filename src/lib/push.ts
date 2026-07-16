"use client";

import { getVapidPublicKey, savePushSubscription, deletePushSubscription } from "@/lib/api";

/** Browsers want the VAPID key as a Uint8Array, and hand out unpadded base64url. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushSupported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

/** Current permission, or "unsupported" when the browser can't do push at all. */
export function pushPermission(): NotificationPermission | "unsupported" {
  return pushSupported() ? Notification.permission : "unsupported";
}

async function registerWorker(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready.then(() => reg);
}

/**
 * Ask for permission (if not already decided), subscribe this browser and store it server-side.
 * Returns false when push is unsupported, denied, or disabled on the server.
 */
export async function enablePush(token: string): Promise<boolean> {
  if (!pushSupported() || !token) return false;

  const publicKey = await getVapidPublicKey().catch(() => "");
  if (!publicKey) return false;   // push disabled server-side

  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== "granted") return false;

  const reg = await registerWorker();
  // Reuse the existing subscription when there is one; the server upserts by endpoint anyway.
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  await savePushSubscription({
    endpoint: sub.endpoint,
    p256dh: arrayBufferToBase64Url(sub.getKey("p256dh")),
    auth: arrayBufferToBase64Url(sub.getKey("auth")),
  }, token);
  return true;
}

/** Unsubscribe this browser and forget it server-side. */
export async function disablePush(token: string): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await deletePushSubscription(endpoint, token).catch(() => {});
}

/**
 * Re-attach a browser that already granted permission, without prompting. Safe to call on every
 * dashboard load: it keeps the stored subscription fresh (they rotate) and no-ops otherwise.
 */
export async function syncPushSubscription(token: string): Promise<void> {
  if (!pushSupported() || !token) return;
  if (Notification.permission !== "granted") return;
  try {
    await enablePush(token);
  } catch {
    /* best-effort */
  }
}
