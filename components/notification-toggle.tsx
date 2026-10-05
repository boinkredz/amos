import { useConvexAuth } from "convex/react";
import { Bell, BellOff, BellRing, Info } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { usePushNotifications } from "@/hooks/use-push-notifications.ts";

/** Card to turn push notifications on/off for this device. */
export default function NotificationToggle() {
  const { isAuthenticated } = useConvexAuth();
  const { status, subscribe, unsubscribe } = usePushNotifications(isAuthenticated);

  if (status === "unsupported") return null;

  const info = {
    iframe: "Notifikasi hanya berfungsi di aplikasi yang sudah dipublish, bukan di pratinjau editor.",
    denied: "Notifikasi diblokir. Buka pengaturan browser > Izin situs > Notifikasi > Izinkan, lalu muat ulang halaman.",
  } as const;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="size-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
          {status === "subscribed" ? <BellRing className="size-4 text-primary" /> : <Bell className="size-4 text-primary" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Notifikasi</p>
          <p className="text-xs text-muted-foreground">
            {status === "iframe" || status === "denied" ? (
              <span className="inline-flex items-start gap-1"><Info className="size-3 mt-0.5 shrink-0" />{info[status]}</span>
            ) : status === "subscribed" ? (
              "Aktif di perangkat ini: check-in/out, pengingat, dan tugas backup."
            ) : (
              "Terima pemberitahuan check-in/out, pengingat, dan tugas backup."
            )}
          </p>
        </div>
      </div>
      {status === "subscribed" ? (
        <Button size="sm" variant="ghost" className="cursor-pointer shrink-0" onClick={() => void unsubscribe()}>
          <BellOff className="size-4" /> Matikan
        </Button>
      ) : status === "unsubscribed" || status === "loading" ? (
        <Button size="sm" className="cursor-pointer shrink-0" disabled={status === "loading"} onClick={() => void subscribe()}>
          {status === "loading" ? "Memproses..." : "Aktifkan"}
        </Button>
      ) : null}
    </div>
  );
}
