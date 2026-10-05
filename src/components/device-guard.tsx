import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useRole } from "@/hooks/use-role.ts";
import { getDeviceFingerprint, getDeviceInfo } from "@/lib/device-fingerprint.ts";
import { ShieldAlert, Smartphone, Home } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

/**
 * Wraps authenticated app content.
 * For device-locked roles (danru, anggota):
 * - First login: auto-registers device
 * - Subsequent logins: blocks access if device doesn't match
 */
export default function DeviceGuard({ children }: { children: React.ReactNode }) {
  const { role, isDeviceLocked, isLoading: roleLoading } = useRole();
  const [fingerprint] = useState(() => getDeviceFingerprint());
  const [deviceInfo] = useState(() => getDeviceInfo());
  const [registrationDone, setRegistrationDone] = useState(false);

  const deviceStatus = useQuery(
    api.devices.checkDevice,
    !roleLoading && isDeviceLocked ? { deviceFingerprint: fingerprint } : "skip",
  );

  const registerDevice = useMutation(api.devices.registerDevice);

  // Auto-register on first login for device-locked roles
  useEffect(() => {
    if (
      !roleLoading &&
      isDeviceLocked &&
      deviceStatus &&
      !deviceStatus.hasRegistration &&
      !registrationDone
    ) {
      registerDevice({ deviceFingerprint: fingerprint, deviceInfo })
        .then(() => setRegistrationDone(true))
        .catch(() => { /* handled by checkDevice query reactivity */ });
    }
  }, [roleLoading, isDeviceLocked, deviceStatus, registrationDone, registerDevice, fingerprint, deviceInfo]);

  // Non-locked roles pass through immediately
  if (!isDeviceLocked || roleLoading) {
    return <>{children}</>;
  }

  // Waiting for device check
  if (deviceStatus === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Memeriksa perangkat...</div>
      </div>
    );
  }

  // Device is valid OR just registered
  if (deviceStatus.isValid || registrationDone) {
    return <>{children}</>;
  }

  // Device BLOCKED — different device than registered
  if (deviceStatus.hasRegistration && !deviceStatus.isValid) {
    function clearCacheAndLogout() {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch { /* ignore */ }
      window.location.href = "/";
    }

    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Perangkat Tidak Terdaftar</h2>
          <p className="text-muted-foreground">
            Akun Anda ({role}) hanya bisa diakses dari perangkat yang sudah terdaftar.
            Perangkat ini berbeda dengan yang tercatat di sistem.
          </p>
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            <span>Hubungi admin untuk melepas kunci perangkat lama.</span>
          </div>
          <div className="pt-2">
            <Button className="w-full" onClick={clearCacheAndLogout}>
              <Home className="size-4 mr-2" />
              Kembali ke Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Registering...
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Mendaftarkan perangkat...</div>
    </div>
  );
}
