/**
 * Photo enrollment — capture a profile selfie for the officer.
 * No AI model required — just a simple photo as reference.
 */
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";
import { Camera, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useCamera } from "@/hooks/use-camera.ts";

interface Props {
  onEnrolled: () => void;
}

export default function FaceEnrollment({ onEnrolled }: Props) {
  const { videoRef, stream, isLoading: camLoading, error: camError, isDenied, start, stop } = useCamera({ facingMode: "user", width: 640, height: 480 });
  const [capturing, setCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const generateUrl = useMutation(api.selfAbsensi.generateAbsensiUploadUrl);
  const saveMutation = useMutation(api.selfAbsensi.saveProfilePhoto);

  // Start camera on mount
  useEffect(() => {
    void start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !stream) return;
    setCapturing(true);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx2d = canvas.getContext("2d");
    if (ctx2d) {
      // Mirror for selfie
      ctx2d.scale(-1, 1);
      ctx2d.drawImage(video, -canvas.width, 0);
    }
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreviewUrl(dataUrl);
    setCapturing(false);
  }

  async function handleSave() {
    if (!previewUrl) return;
    setSaving(true);
    try {
      // Convert data URL to blob
      const res = await fetch(previewUrl);
      const blob = await res.blob();

      // Upload to Convex storage
      const uploadUrl = await generateUrl();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      const { storageId } = (await uploadRes.json()) as { storageId: string };

      // Save to officer record
      await saveMutation({ photoStorageId: storageId });
      stop();
      toast.success("Foto profil berhasil disimpan!");
      onEnrolled();
    } catch {
      toast.error("Gagal menyimpan foto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground">
        <strong>Ambil foto profil</strong> — foto ini digunakan sebagai referensi untuk verifikasi kehadiran Anda.
      </div>

      {/* Camera feed or preview */}
      <div className="relative aspect-square max-w-xs mx-auto overflow-hidden rounded-xl bg-black">
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover scale-x-[-1]"
            />
            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-40 rounded-full border-2 border-white/60 border-dashed" />
            </div>
          </>
        )}
      </div>

      {camError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {camError}
          {isDenied && <p className="mt-1 text-xs">Aktifkan izin kamera di pengaturan browser, lalu muat ulang halaman.</p>}
        </div>
      )}

      {!previewUrl ? (
        <Button
          className="w-full"
          onClick={capturePhoto}
          disabled={!stream || capturing || camLoading}
        >
          <Camera className="size-4 mr-2" />
          {camLoading ? "Membuka kamera..." : "Ambil Foto"}
        </Button>
      ) : (
        <div className="space-y-2">
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            <CheckCircle2 className="size-4 mr-2" />
            {saving ? "Menyimpan..." : "Simpan Foto Profil"}
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setPreviewUrl(null)}>
            <RefreshCw className="size-3 mr-2" /> Ambil ulang
          </Button>
        </div>
      )}
    </div>
  );
}
