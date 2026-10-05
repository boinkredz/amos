import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Authenticated } from "convex/react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert,
  FileCheck, Loader2, Clock, MapPin,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { cn } from "@/lib/utils.ts";

type CheckpointItem = {
  _id: Id<"checkpoint">;
  nama: string;
  urutan: number;
  deskripsi?: string;
};

type ChecklistItem = {
  _id: Id<"checklistPatroli">;
  checkpointId: Id<"checkpoint">;
  dikunjungi: boolean;
  waktuKunjungan?: string;
  temuanStatus: "normal" | "temuan" | "darurat";
  catatan?: string;
  fotoUrl?: string;
  lokasiKunjungan?: { lat: number; lng: number };
};

type TugasItem = {
  _id: Id<"tugasPatroli">;
  ruteId: Id<"rutePatroli">;
  tanggal: string;
  jamMulaiRencana: string;
  jamSelesaiRencana: string;
  status: "dijadwalkan" | "berlangsung" | "selesai" | "dibatalkan";
  waktuMulai?: string;
  waktuSelesai?: string;
  rute: { _id: string; nama: string; estimasiMenit: number } | null;
  officer: { _id: string; nama: string; jabatan: string } | null;
  totalCheckpoints: number;
  checkpointsDikunjungi: number;
};

const TEMUAN_CONFIG = {
  normal: { label: "Normal", icon: CheckCircle2, badgeCls: "bg-green-600 text-white" },
  temuan: { label: "Temuan", icon: AlertTriangle, badgeCls: "bg-yellow-500 text-white" },
  darurat: { label: "Darurat", icon: ShieldAlert, badgeCls: "bg-destructive text-white" },
};

function LaporanContent() {
  const { tugasId } = useParams<{ tugasId: string }>();
  const navigate = useNavigate();

  const currentTask = useQuery(
    api.patroli.getTugasById,
    tugasId ? { tugasId: tugasId as Id<"tugasPatroli"> } : "skip",
  ) as TugasItem | null | undefined;

  const checkpoints = useQuery(
    api.patroli.listCheckpoints,
    currentTask?.ruteId ? { ruteId: currentTask.ruteId } : "skip",
  );

  const checklist = useQuery(
    api.patroli.getChecklist,
    tugasId ? { tugasId: tugasId as Id<"tugasPatroli"> } : "skip",
  );

  const updateStatus = useMutation(api.patroli.updateTugasStatus);

  const [konfirmasi, setKonfirmasi] = useState(false);
  const [catatanHasil, setCatatanHasil] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!tugasId || !currentTask) return;
    if (!konfirmasi) { toast.error("Centang pernyataan konfirmasi terlebih dahulu"); return; }
    setSubmitting(true);
    try {
      await updateStatus({
        tugasId: tugasId as Id<"tugasPatroli">,
        status: "selesai",
        waktuSelesai: new Date().toISOString(),
        catatanHasil: catatanHasil || undefined,
      });
      toast.success("Laporan berhasil disubmit ke supervisor");
      navigate("/patroli");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal submit laporan");
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = currentTask === undefined || checkpoints === undefined || checklist === undefined;

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
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

  const checklistMap = new Map<string, ChecklistItem>();
  (checklist as ChecklistItem[]).forEach((cl) => checklistMap.set(cl.checkpointId, cl));

  const totalCp = checkpoints.length;
  const doneCp = checklist.filter((cl) => cl.dikunjungi).length;
  const temuanCount = checklist.filter((cl) => cl.temuanStatus === "temuan").length;
  const daruratCount = checklist.filter((cl) => cl.temuanStatus === "darurat").length;
  const isAlreadyDone = currentTask.status === "selesai";

  const displayDate = format(
    new Date(currentTask.tanggal + "T12:00:00"),
    "EEEE, d MMMM yyyy",
    { locale: idLocale },
  );

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/patroli/tugas/${tugasId}`)} className="cursor-pointer">
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="font-bold text-lg">Laporan Patroli</h1>
          <p className="text-sm text-muted-foreground capitalize">{displayDate}</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">{currentTask.rute?.nama ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{currentTask.officer?.nama} · {currentTask.officer?.jabatan}</p>
          </div>
          <Badge className={cn(
            currentTask.status === "dijadwalkan" && "bg-secondary text-secondary-foreground",
            currentTask.status === "berlangsung" && "bg-blue-600 text-white",
            currentTask.status === "selesai" && "bg-green-600 text-white",
            currentTask.status === "dibatalkan" && "bg-destructive text-white",
          )}>
            {currentTask.status.charAt(0).toUpperCase() + currentTask.status.slice(1)}
          </Badge>
        </div>
        <Separator />
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-2xl font-bold">{doneCp}/{totalCp}</p>
            <p className="text-xs text-muted-foreground">Checkpoint</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">{temuanCount}</p>
            <p className="text-xs text-muted-foreground">Temuan</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{daruratCount}</p>
            <p className="text-xs text-muted-foreground">Darurat</p>
          </div>
        </div>
        {currentTask.waktuMulai && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            Mulai: {format(new Date(currentTask.waktuMulai), "HH:mm")}
            {currentTask.waktuSelesai && ` · Selesai: ${format(new Date(currentTask.waktuSelesai), "HH:mm")}`}
          </div>
        )}
      </div>

      {/* Checkpoint Detail */}
      <div>
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Detail Checkpoint</h2>
        <div className="space-y-2">
          {(checkpoints as CheckpointItem[]).map((cp) => {
            const cl = checklistMap.get(cp._id);
            const tc = cl ? TEMUAN_CONFIG[cl.temuanStatus] : null;
            const Icon = tc?.icon;

            return (
              <div key={cp._id} className={cn(
                "rounded-lg border p-3",
                !cl?.dikunjungi && "opacity-60",
              )}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                    cl?.dikunjungi ? "bg-green-600 text-white" : "bg-muted text-muted-foreground",
                  )}>
                    {cp.urutan}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{cp.nama}</span>
                      {tc && Icon && (
                        <Badge className={cn("text-[10px] px-1.5 py-0", tc.badgeCls)}>
                          <Icon className="size-3 mr-1" />{tc.label}
                        </Badge>
                      )}
                      {!cl?.dikunjungi && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Dilewati</Badge>
                      )}
                    </div>
                    {cl?.waktuKunjungan && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="size-3" />{format(new Date(cl.waktuKunjungan), "HH:mm")}
                        {cl.lokasiKunjungan && (
                          <span className="flex items-center gap-1 ml-2">
                            <MapPin className="size-3" />
                            {cl.lokasiKunjungan.lat.toFixed(4)}, {cl.lokasiKunjungan.lng.toFixed(4)}
                          </span>
                        )}
                      </p>
                    )}
                    {cl?.catatan && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{cl.catatan}</p>
                    )}
                    {cl?.fotoUrl && (
                      <img src={cl.fotoUrl} alt="bukti" className="mt-2 h-16 w-auto rounded object-cover border" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit Section */}
      {!isAlreadyDone && (
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="font-semibold">Submit Laporan ke Supervisor</h2>

          <div>
            <Label className="mb-2 block">Catatan Hasil Patroli</Label>
            <Textarea
              value={catatanHasil}
              onChange={(e) => setCatatanHasil(e.target.value)}
              placeholder="Ringkasan kondisi umum, temuan penting, atau rekomendasi tindak lanjut..."
              rows={3}
            />
          </div>

          <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id="konfirmasi"
              checked={konfirmasi}
              onCheckedChange={(v) => setKonfirmasi(v === true)}
              className="mt-0.5 cursor-pointer"
            />
            <Label htmlFor="konfirmasi" className="text-sm leading-relaxed cursor-pointer">
              Saya, <strong>{currentTask.officer?.nama ?? "petugas"}</strong>, menyatakan bahwa laporan patroli ini
              benar dan akurat sesuai dengan kondisi yang saya temui di lapangan.
            </Label>
          </div>

          <Button
            className="w-full cursor-pointer gap-2"
            onClick={handleSubmit}
            disabled={!konfirmasi || submitting}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileCheck className="size-4" />}
            Submit Laporan ke Supervisor
          </Button>
        </div>
      )}

      {isAlreadyDone && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 p-4">
          <CheckCircle2 className="size-6 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800 dark:text-green-300">Laporan Sudah Disubmit</p>
            {currentTask.waktuSelesai && (
              <p className="text-xs text-green-700 dark:text-green-400">
                Diselesaikan pada {format(new Date(currentTask.waktuSelesai), "HH:mm, d MMM yyyy")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LaporanPage() {
  return (
    <Authenticated>
      <LaporanContent />
    </Authenticated>
  );
}
