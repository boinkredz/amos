/**
 * Geolocation + photo capture flow for check-in/out.
 * No AI face verification — just capture a selfie as attendance proof.
 */
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { Camera, MapPin, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useCamera } from "@/hooks/use-camera.ts";
import { ConvexError } from "convex/values";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Props {
  mode: "masuk" | "keluar";
  tanggal: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = "location" | "camera" | "uploading" | "done";

export default function AbsensiCapture({ mode, tanggal, onSuccess, onCancel }: Props) {
  const { videoRef, stream, isLoading: camLoading, error: camError, isDenied, start, stop } = useCamera({ facingMode: "user" });
  const [step, setStep] = useState<Step>("location");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const generateUrl = useMutation(api.selfAbsensi.generateAbsensiUploadUrl);
  const checkInMutation = useMutation(api.selfAbsensi.selfCheckIn);
  const checkOutMutation = useMutation(api.selfAbsensi.selfCheckOut);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError("Geolokasi tidak didukung browser ini");
      return;
    }
    setLocLoading(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
        setStep("camera");
      },
      (err) => {
        setLocationError(err.message || "Gagal mendapatkan lokasi. Aktifkan GPS.");
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  useEffect(() => {
    if (step === "camera") void start();
    if (step !== "camera") stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || !stream || !location) return;
    setStep("uploading");
    setErrorMsg(null);

    try {
      // Capture photo from video
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx2d = canvas.getContext("2d");
      if (ctx2d) {
        ctx2d.scale(-1, 1);
        ctx2d.drawImage(video, -canvas.width, 0);
      }
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(), "image/jpeg", 0.85));

      // Upload photo
      const uploadUrl = await generateUrl();
      const uploadRes = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      const { storageId } = (await uploadRes.json()) as { storageId: string };

      stop();

      // Submit attendance
      if (mode === "masuk") {
        const res = await checkInMutation({ lat: location.lat, lng: location.lng, fotoStorageId: storageId, tanggal });
        if (res.status === "terlambat") {
          toast.warning(`Anda tercatat terlambat ${res.keterlambatanMenit} menit`);
        }
      } else {
        const res = await checkOutMutation({ lat: location.lat, lng: location.lng, fotoStorageId: storageId, tanggal });
        if (res.pulangCepatMenit > 0) {
          toast.warning(`Anda tercatat pulang cepat ${res.pulangCepatMenit} menit sebelum shift selesai`);
        }
      }
      setStep("done");
      toast.success(mode === "masuk" ? "Absen masuk berhasil!" : "Absen keluar berhasil!");
      setTimeout(onSuccess, 1500);
    } catch (err) {
      stop();
      const msg = err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal absen";
      toast.error(msg);
      setErrorMsg(msg);
      setStep("location");
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-center">
        Absen {mode === "masuk" ? "Masuk" : "Keluar"} — {format(new Date(tanggal + "T12:00:00"), "EEEE, d MMMM yyyy", { locale: idLocale })}
      </div>

      {/* Step: Location */}
      {step === "location" && (
        <div className="space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}
          <div className="rounded-lg border bg-secondary/40 p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <MapPin className="size-4 text-primary" />
              Verifikasi Lokasi
            </div>
            <p className="text-muted-foreground text-xs">Izinkan akses lokasi untuk memverifikasi Anda berada di zona kerja.</p>
          </div>
          {locationError && (
            <div className="text-sm text-destructive">{locationError}</div>
          )}
          {location ? (
            <div className="text-xs text-muted-foreground text-center">
              Lokasi: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </div>
          ) : null}
          <Button className="w-full" onClick={requestLocation} disabled={locLoading}>
            <MapPin className="size-4 mr-2" />
            {locLoading ? "Mendapatkan lokasi..." : "Izinkan Akses Lokasi"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>Batal</Button>
        </div>
      )}

      {/* Step: Camera */}
      {step === "camera" && (
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-black max-w-xs mx-auto">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-44 rounded-full border-2 border-white/60 border-dashed" />
            </div>
          </div>
          {camError && (
            <div className="text-sm text-destructive">{camError}</div>
          )}
          <Button className="w-full" onClick={handleCapture} disabled={!stream || camLoading}>
            <Camera className="size-4 mr-2" />
            Ambil Foto & Absen
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => { stop(); setStep("location"); }}>Kembali</Button>
        </div>
      )}

      {/* Step: Uploading */}
      {step === "uploading" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <RefreshCw className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Mengupload foto & menyimpan absensi...</p>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <CheckCircle2 className="size-10 text-green-500" />
          <p className="font-medium">Absensi berhasil dicatat</p>
        </div>
      )}
    </div>
  );
}
