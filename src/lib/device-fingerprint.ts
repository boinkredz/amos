const STORAGE_KEY = "smok_device_token";

/**
 * Generate a device fingerprint based on browser characteristics.
 * Best-effort, not 100% unforgeable, but sufficient for basic device lock.
 */
export function getDeviceFingerprint(): string {
  // Use a persistent token in localStorage as the primary identifier
  let storedToken = localStorage.getItem(STORAGE_KEY);
  if (!storedToken) {
    storedToken = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, storedToken);
  }
  return storedToken;
}

/**
 * Get human-readable device info string
 */
export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  const screen = `${window.screen.width}x${window.screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${ua} | ${screen} | ${timezone}`;
}
