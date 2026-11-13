"use client";

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { PushNotifications } from "@capacitor/push-notifications";

// The TopTrack iPhone app (capacitor.config.ts) opens this same site in a
// web view. These are the few things it does differently there: push
// notifications go through Apple (a web view can't do web push), and the
// sign-in is also kept in the phone's own storage, so nobody has to sign in
// again even if the web view drops its cookies.

export const isApp = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

// ---- push ------------------------------------------------------------------

export type AppPush = "granted" | "denied" | "ask";

export async function appPushState(): Promise<AppPush> {
  const { receive } = await PushNotifications.checkPermissions();
  return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "ask";
}

let listening = false;

// With `ask`, shows the phone's own question if it hasn't been asked yet.
// Saves the phone's push address the same way a browser's is saved, as
// "apns:<token>" (see /api/push/send).
export async function enableAppPush(save: (endpoint: string) => Promise<void>, ask: boolean) {
  if (!isApp() || Capacitor.getPlatform() !== "ios") return;
  try {
    let state = await appPushState();
    if (state === "ask" && ask) state = (await PushNotifications.requestPermissions()).receive === "granted" ? "granted" : "denied";
    if (state !== "granted") return;
    if (!listening) {
      listening = true;
      await PushNotifications.addListener("registration", ({ value }) => void save(`apns:${value}`).catch(() => {}));
      // tapping a notification opens the page it points at
      await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const url = (notification.data as { url?: string } | undefined)?.url;
        if (url && url.startsWith("/") && url !== window.location.pathname) window.location.assign(url);
      });
    }
    await PushNotifications.register();
  } catch {
    // no notifications on this phone; everything else carries on
  }
}

// ---- staying signed in ------------------------------------------------------

const KEY = "tt-refresh";

export async function rememberSignIn(refreshToken: string | null) {
  if (!isApp()) return;
  try {
    if (refreshToken) await Preferences.set({ key: KEY, value: refreshToken });
    else await Preferences.remove({ key: KEY });
  } catch {}
}

export async function savedSignIn() {
  if (!isApp()) return null;
  try {
    return (await Preferences.get({ key: KEY })).value;
  } catch {
    return null;
  }
}
