// The Capacitor PushNotifications plugin provided by the Hercules iOS app
type PermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied";

interface PluginListenerHandle {
  remove: () => Promise<void>;
}

interface NativePushNotifications {
  checkPermissions: () => Promise<{ receive: PermissionState }>;
  requestPermissions: () => Promise<{ receive: PermissionState }>;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  addListener(event: "registration", listener: (token: { value: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: "registrationError", listener: (error: { error: string }) => void): Promise<PluginListenerHandle>;
}

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: { PushNotifications?: NativePushNotifications };
    };
  }
}

export function getNativePush(): NativePushNotifications | null {
  if (!window.Capacitor?.isNativePlatform?.()) return null;
  return window.Capacitor.Plugins?.PushNotifications ?? null;
}

/** Asks iOS for permission and resolves with the APNs device token, or null when declined. */
export async function registerNativePush(push: NativePushNotifications): Promise<string | null> {
  const { receive } = await push.requestPermissions();
  if (receive !== "granted") return null;

  const handles: Promise<PluginListenerHandle>[] = [];
  const removeListeners = () => {
    for (const handle of handles) void handle.then((h) => h.remove());
  };
  return new Promise((resolve, reject) => {
    handles.push(
      push.addListener("registration", ({ value }) => {
        removeListeners();
        resolve(value);
      }),
      push.addListener("registrationError", ({ error }) => {
        removeListeners();
        reject(new Error(error));
      }),
    );
    void push.register();
  });
}
