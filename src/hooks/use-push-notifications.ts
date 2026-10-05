import { api } from "@/convex/_generated/api.js";
import { getNativePush, registerNativePush } from "@/lib/native-push.ts";
import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const SECRET_KEY = "push-subscription-secret";

export type NotificationStatus = "unsupported" | "iframe" | "denied" | "loading" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function usePushNotifications(isAuthenticated?: boolean) {
  const [secret, setSecret] = useState<string | null>(() => localStorage.getItem(SECRET_KEY));
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    () => ("Notification" in window ? Notification.permission : null),
  );
  const getVapidPublicKey = useAction(api.pushNotifications.getVapidPublicKey);
  const registerSubscription = useAction(api.pushNotifications.subscribe);
  const identifySubscription = useAction(api.pushNotifications.identify);
  const removeSubscription = useAction(api.pushNotifications.unsubscribe);
  const hasIdentified = useRef(false);
  const nativePush = useMemo(() => getNativePush(), []);

  useEffect(() => {
    if (!nativePush) return;
    void nativePush.checkPermissions().then(({ receive }) => {
      setPermission(receive === "granted" ? "granted" : receive === "denied" ? "denied" : "default");
    });
  }, [nativePush]);

  const status: NotificationStatus = useMemo(() => {
    if (!nativePush && (!("Notification" in window) || !("serviceWorker" in navigator))) return "unsupported";
    if (!nativePush && isInIframe()) return "iframe";
    if (permission === "denied") return "denied";
    if (isLoading) return "loading";
    if (secret !== null) return "subscribed";
    return "unsubscribed";
  }, [nativePush, permission, isLoading, secret]);

  const subscribe = useCallback(async () => {
    if (status === "unsupported" || status === "iframe" || status === "denied") return;
    setIsLoading(true);
    try {
      let newSecret: string;
      if (nativePush) {
        const token = await registerNativePush(nativePush);
        if (!token) {
          setPermission("denied");
          return;
        }
        ({ secret: newSecret } = await registerSubscription({ nativeDevice: { platform: "ios", token } }));
      } else {
        const { vapidPublicKey } = await getVapidPublicKey();
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") return;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
        ({ secret: newSecret } = await registerSubscription({ subscription: JSON.stringify(subscription) }));
      }
      localStorage.setItem(SECRET_KEY, newSecret);
      setSecret(newSecret);
      hasIdentified.current = true;
      toast.success("Notifikasi diaktifkan");
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengaktifkan notifikasi. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }, [status, nativePush, getVapidPublicKey, registerSubscription]);

  // Link any existing device subscription to the signed-in account
  useEffect(() => {
    if (isAuthenticated && !hasIdentified.current && secret) {
      hasIdentified.current = true;
      identifySubscription({ secret }).catch(() => undefined);
    }
    if (!isAuthenticated) hasIdentified.current = false;
  }, [isAuthenticated, secret, identifySubscription]);

  const unsubscribe = useCallback(async () => {
    const currentSecret = localStorage.getItem(SECRET_KEY);
    if (!currentSecret) return;
    setIsLoading(true);
    try {
      if (nativePush) {
        await nativePush.unregister();
      } else if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        await subscription?.unsubscribe();
      }
      await removeSubscription({ secret: currentSecret });
    } catch (error) {
      console.error(error);
    } finally {
      // Always clear locally so the next user on this device doesn't inherit it
      localStorage.removeItem(SECRET_KEY);
      setSecret(null);
      setIsLoading(false);
    }
  }, [nativePush, removeSubscription]);

  return { status, subscribe, unsubscribe };
}
