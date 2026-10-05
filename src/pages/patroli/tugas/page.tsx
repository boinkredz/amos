import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { Authenticated } from "convex/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  ArrowLeft, MapPin, Camera, CheckCircle2, AlertTriangle,
  ShieldAlert, FileText, Loader2, RotateCcw, Check,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";

// Haversine distance in meters
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const GPS_RADIUS_M = 50;

type CheckpointData = {
  _id: Id<"checkpoint">;
  nama: string;
  urutan: number;
  deskripsi?: string;
  koordinat?: { lat: number; lng: number };
  qrCode?: string;
};

type ChecklistData = {
  _id: Id<"checklistPatroli">;
  checkpointId: Id<"checkpoint">;
  dikunjungi: boolean;
  waktuKunjungan?: string;
  lokasiKunjungan?: { lat: number; lng: number };
  temuanStatus: "normal" | "temuan" | "darurat";
  catatan?: string;
  fotoId?: Id<"_storage">;
  fotoUrl?: string;
  validasiGPS?: boolean;
};

type TugasType = {
  _id: Id<"tugasPatroli">;
  ruteId: Id<"rutePatroli">;
  officerId: Id<"officers">;
  tanggal: string;
  jamMulaiRencana: string;
  jamSelesaiRencana: string;
  status: "dijadwalkan" | "berlangsung" | "selesai" | "dibatalkan";
  waktuMulai?: string;
  lokasiTerakhir?: { lat: number; lng: number };
  rute: { _id: string; nama: string; estimasiMenit: number } | null;
  officer: { _id: string; nama: string; jabatan: string } | null;
  totalCheckpoints: number;
  checkpointsDikunjungi: number;
};

// ─── Checkpoint Form (camera capture + GPS lock) ───────────────────────────────

type CheckpointFormProps = {
  open: boolean;
  onClose: () => void;
  tugasId: Id<"tugasPatroli">;
  checkpoint: CheckpointData;
  existing: ChecklistData | null;
  gpsLoc: { lat: number; lng: number } | null;
};

function CheckpointFormDialog({ open, onClose, tugasId, checkpoint, existing, gpsLoc }: CheckpointFormProps) {
  const saveChecklist = useMutation(api.patroli.saveChecklist);
  const generateUrl = useMutation(api.patroli.generateUploadUrl);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [temuanStatus, setTemuanStatus] = useState<"normal" | "temuan" | "darurat">(existing?.temuanStatus ?? "normal");
  const [catatan, setCatatan] = useState(existing?.catatan ?? "");
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [saving, setSaving] = useState(false);

  // GPS distance to checkpoint
  const distanceM =
    checkpoint.koordinat && gpsLoc
      ? haversine(gpsLoc.lat, gpsLoc.lng, checkpoint.koordinat.lat, checkpoint.koordinat.lng)
      : null;
  const gpsLocked = distanceM !== null && distanceM > GPS_RADIUS_M;
  const gpsValid = distanceM !== null && distanceM <= GPS_RADIUS_M;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setCameraError(true);
      toast.error("Tidak dapat mengakses kamera. Izinkan akses kamera di browser.");
    }
  }, []);

  // Reset state + start camera when dialog opens
  useEffect(() => {
    if (open) {
      setTemuanStatus(existing?.temuanStatus ?? "normal");
      setCatatan(existing?.catatan ?? "");
      setFotoBlob(null);
      setFotoPreview(null);
      startCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Gagal mengambil foto");
          return;
        }
        setFotoBlob(blob);
        setFotoPreview(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.85,
    );
  };

  const retake = () => {
    setFotoBlob(null);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    startCamera();
  };

  const handleSave = async () => {
    if (!fotoBlob) {
      toast.error("Foto wajib diambil sebelum menyimpan");
      return;
    }
    setSaving(true);
    try {
      const uploadUrl = await generateUrl({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: fotoBlob,
      });
      if (!res.ok) throw new Error("Upload foto gagal");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };

      await saveChecklist({
        tugasId,
        checkpointId: checkpoint._id,
        dikunjungi: true,
        waktuKunjungan: new Date().toISOString(),
        lokasiKunjungan: gpsLoc ?? undefined,
        temuanStatus,
        catatan: catatan || undefined,
        fotoId: storageId,
        validasiGPS: gpsValid,
      });
      toast.success("Checkpoint dicatat");
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopCamera(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="size-5" />
            #{checkpoint.urutan} {checkpoint.nama}
          </DialogTitle>
        </DialogHeader>

        {/* GPS status */}
        {distanceM !== null && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
              gpsLocked
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-green-500/30 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400",
            )}
          >
            {gpsLocked ? <AlertTriangle className="size-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="size-4 mt-0.5 shrink-0" />}
            <span>
              {gpsLocked
                ? `Terlalu jauh dari checkpoint (${Math.round(distanceM)}m). Dekat dulu dengan checkpoint.`
                : `Anda berada di lokasi checkpoint (${Math.round(distanceM)}m).`}
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Foto Bukti (Wajib)</Label>
            <div className="relative overflow-hidden rounded-lg bg-black aspect-[4/3]">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Foto bukti" className="w-full h-full object-cover" />
              ) : (
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              )}
              <canvas ref={canvasRef} className="hidden" />
              {!fotoPreview && !cameraReady && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white bg-black/70">
                  <Loader2 className="size-8 animate-spin" />
                  <p className="text-sm">Memulai kamera...</p>
                </div>
              )}
              {cameraError && !fotoPreview && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-black/80 p-4 text-center">
                  <AlertTriangle className="size-8" />
                  <p className="text-sm">Kamera tidak tersedia.</p>
                  <Button size="sm" variant="secondary" className="cursor-pointer" onClick={startCamera}>
                    Coba Lagi
                  </Button>
                </div>
              )}
            </div>

            {/* Camera action */}
            <div className="mt-2">
              {fotoPreview ? (
                <Button variant="secondary" className="w-full cursor-pointer gap-2" onClick={retake}>
                  <RotateCcw className="size-4" /> Ambil Ulang
                </Button>
              ) : (
                <Button
                  className="w-full cursor-pointer gap-2"
                  onClick={capturePhoto}
                  disabled={!cameraReady || gpsLocked}
                >
                  <Camera className="size-4" /> Ambil Foto
                </Button>
              )}
              {gpsLocked && !fotoPreview && (
                <p className="mt-1 text-xs text-destructive">
                  Tombol terkunci karena Anda di luar radius {GPS_RADIUS_M}m checkpoint.
                </p>
              )}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Status Temuan</Label>
            <Select value={temuanStatus} onValueChange={(v) => setTemuanStatus(v as "normal" | "temuan" | "darurat")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">
                  <span className="flex items-center gap-2"><Check className="size-4 text-green-600" /> Normal — Aman</span>
                </SelectItem>
                <SelectItem value="temuan">
                  <span className="flex items-center gap-2"><AlertTriangle className="size-4 text-yellow-600" /> Temuan — Perlu Perhatian</span>
                </SelectItem>
                <SelectItem value="darurat">
                  <span className="flex items-center gap-2"><ShieldAlert className="size-4 text-red-600" /> Darurat — Segera Ditangani</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Catatan</Label>
            <Textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Deskripsi kondisi, temuan, atau catatan..."
              rows={3}
            />
          </div>

          {gpsLoc && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="size-3" />
              GPS: {gpsLoc.lat.toFixed(5)}, {gpsLoc.lng.toFixed(5)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { stopCamera(); onClose(); }}>Batal</Button>
          <Button onClick={handleSave} disabled={saving || !fotoBlob} className="cursor-pointer gap-1">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function TugasDetailContent() {
  const { tugasId } = useParams<{ tugasId: string }>();
  const navigate = useNavigate();

  const currentTask = useQuery(
    api.patroli.getTugasById,
    tugasId ? { tugasId: tugasId as Id<"tugasPatroli"> } : "skip",
  ) as TugasType | null | undefined;

  const checkpoints = useQuery(
    api.patroli.listCheckpoints,
    currentTask?.ruteId ? { ruteId: currentTask.ruteId } : "skip",
  );

  const checklist = useQuery(
    api.patroli.getChecklist,
    tugasId ? { tugasId: tugasId as Id<"tugasPatroli"> } : "skip",
  );

  const updateStatus = useMutation(api.patroli.updateTugasStatus);

  const [formCheckpoint, setFormCheckpoint] = useState<CheckpointData | null>(null);
  const [gpsLoc, setGpsLoc] = useState<{ lat: number; lng: number } | null>(null);

  // Get GPS on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => setGpsLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true },
      );
    }
  }, []);

  const openCheckpoint = async (cp: CheckpointData) => {
    if (!tugasId) return;
    // Start task if still dijadwalkan
    if (currentTask?.status === "dijadwalkan") {
      await updateStatus({
        tugasId: tugasId as Id<"tugasPatroli">,
        status: "berlangsung",
        waktuMulai: new Date().toISOString(),
        lokasiTerakhir: gpsLoc ?? undefined,
      }).catch(() => {});
    }
    setFormCheckpoint(cp);
  };

  const handleStartPatroli = async () => {
    if (!tugasId || !currentTask) return;
    try {
      await updateStatus({
        tugasId: tugasId as Id<"tugasPatroli">,
        status: "berlangsung",
        waktuMulai: new Date().toISOString(),
        lokasiTerakhir: gpsLoc ?? undefined,
      });
      toast.success("Patroli dimulai");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal memulai patroli");
    }
  };

  if (!tugasId) {
    navigate("/patroli");
    return null;
  }

  const isLoading = currentTask === undefined || checkpoints === undefined || checklist === undefined;

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (!currentTask) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertTriangle className="size-10" />
        <p>Tugas tidak ditemukan</p>
        <Button variant="ghost" onClick={() => navigate("/patroli")}>Kembali</Button>
      </div>
    );
  }

  const checklistMap = new Map<string, ChecklistData>();
  (checklist as ChecklistData[]).forEach((cl) => checklistMap.set(cl.checkpointId, cl));

  const totalCp = checkpoints.length;
  const doneCp = checklist.filter((cl) => cl.dikunjungi).length;
  const pct = totalCp > 0 ? Math.round((doneCp / totalCp) * 100) : 0;

  const TEMUAN_CONFIG = {
    normal: { label: "Normal", icon: CheckCircle2, cls: "text-green-600" },
    temuan: { label: "Temuan", icon: AlertTriangle, cls: "text-yellow-600" },
    darurat: { label: "Darurat", icon: ShieldAlert, cls: "text-red-600" },
  };

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/patroli")} className="cursor-pointer">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">{currentTask.rute?.nama ?? "Patroli"}</h1>
          <p className="text-sm text-muted-foreground">
            {currentTask.officer?.nama} · {currentTask.tanggal} · {currentTask.jamMulaiRencana}–{currentTask.jamSelesaiRencana}
          </p>
        </div>
        <Badge className={cn(
          currentTask.status === "dijadwalkan" && "bg-secondary text-secondary-foreground",
          currentTask.status === "berlangsung" && "bg-blue-600 text-white",
          currentTask.status === "selesai" && "bg-green-600 text-white",
          currentTask.status === "dibatalkan" && "bg-destructive text-white",
        )}>
          {currentTask.status === "dijadwalkan" && "Dijadwalkan"}
          {currentTask.status === "berlangsung" && "Berlangsung"}
          {currentTask.status === "selesai" && "Selesai"}
          {currentTask.status === "dibatalkan" && "Dibatalkan"}
        </Badge>
      </div>

      {/* Progress */}
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress Checkpoint</span>
          <span className="text-muted-foreground">{doneCp} / {totalCp}</span>
        </div>
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground">{pct}% selesai</p>
      </div>

      {/* Start Patrol Button */}
      {currentTask.status === "dijadwalkan" && (
        <Button className="w-full cursor-pointer" onClick={handleStartPatroli}>
          Mulai Patroli
        </Button>
      )}

      {/* Info: catat checkpoint via kamera */}
      {(currentTask.status === "berlangsung" || currentTask.status === "dijadwalkan") && (
        <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Camera className="size-4 mt-0.5 shrink-0" />
          <span>{`Tekan "Catat" pada checkpoint untuk mengambil foto bukti. Tombol foto aktif saat Anda berada dalam radius ${GPS_RADIUS_M}m checkpoint.`}</span>
        </div>
      )}

      {/* Checkpoint List */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Daftar Checkpoint</h2>
        {(checkpoints as CheckpointData[]).map((cp) => {
          const cl = checklistMap.get(cp._id);
          const done = cl?.dikunjungi ?? false;
          const tc = done ? TEMUAN_CONFIG[cl!.temuanStatus] : null;
          const Icon = tc?.icon ?? null;

          return (
            <div
              key={cp._id}
              className={cn(
                "rounded-lg border p-4 flex items-start gap-3",
                done && "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20",
              )}
            >
              <div className={cn(
                "size-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5",
                done ? "bg-green-600 text-white" : "bg-muted text-muted-foreground",
              )}>
                {done ? <Check className="size-4" /> : cp.urutan}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{cp.nama}</p>
                {cp.deskripsi && <p className="text-xs text-muted-foreground">{cp.deskripsi}</p>}
                {done && cl && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {Icon && (
                      <span className={cn("flex items-center gap-1 text-xs font-medium", tc!.cls)}>
                        <Icon className="size-3" /> {tc!.label}
                      </span>
                    )}
                    {cl.waktuKunjungan && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(cl.waktuKunjungan), "HH:mm")}
                      </span>
                    )}
                    {cl.catatan && (
                      <span className="text-xs text-muted-foreground italic line-clamp-1">{cl.catatan}</span>
                    )}
                    {cl.fotoUrl && (
                      <img src={cl.fotoUrl} alt="bukti" className="size-6 rounded object-cover border" />
                    )}
                  </div>
                )}
              </div>
              {!done && (currentTask.status === "berlangsung" || currentTask.status === "dijadwalkan") && (
                <Button
                  variant="secondary" size="sm" className="shrink-0 cursor-pointer text-xs h-7 gap-1"
                  onClick={() => openCheckpoint(cp)}
                >
                  <Camera className="size-3" /> Catat
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Laporan Button */}
      {currentTask.status !== "dibatalkan" && (
        <Button
          variant="default" size="lg"
          className="w-full cursor-pointer gap-2"
          onClick={() => navigate(`/patroli/laporan/${tugasId}`)}
        >
          <FileText className="size-5" /> Lihat & Submit Laporan
        </Button>
      )}

      {formCheckpoint && (
        <CheckpointFormDialog
          open={!!formCheckpoint}
          onClose={() => setFormCheckpoint(null)}
          tugasId={tugasId as Id<"tugasPatroli">}
          checkpoint={formCheckpoint}
          existing={checklistMap.get(formCheckpoint._id) ?? null}
          gpsLoc={gpsLoc}
        />
      )}
    </div>
  );
}

export default function TugasDetailPage() {
  return (
    <Authenticated>
      <TugasDetailContent />
    </Authenticated>
  );
}
