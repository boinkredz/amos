import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Clock, LogIn, LogOut, MapPin, Camera, User, CheckCircle2, AlertCircle, RotateCcw, BellRing,
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import FaceEnrollment from "./_components/face-enrollment.tsx";
import AbsensiCapture from "./_components/absensi-capture.tsx";
import BackupBadge from "@/components/backup-badge.tsx";
import NotificationToggle from "@/components/notification-toggle.tsx";

const today = format(new Date(), "yyyy-MM-dd");

function AbsenMandiriContent() {
  const data = useQuery(api.selfAbsensi.getMyTodayAssignment, {});
  const clearEnrollment = useMutation(api.selfAbsensi.clearFaceEnrollment);

  const [showEnroll, setShowEnroll] = useState(false);
  const [absenMode, setAbsenMode] = useState<"masuk" | "keluar" | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-2">
        <User className="size-10 mx-auto text-muted-foreground" />
        <p className="font-medium">Akun belum terhubung</p>
        <p className="text-sm text-muted-foreground">
          Akun Anda belum dihubungkan ke data petugas. Hubungi admin untuk menghubungkan akun.
        </p>
      </div>
    );
  }

  const { officer: officerRaw, assignment, shift, absensi } = data;
  const officer = officerRaw as typeof officerRaw & { profilePhotoUrl?: string | null };
  const isEnrolled = !!officerRaw.faceDescriptors;
  const hasMasuk = !!absensi?.waktuMasuk;
  const hasKeluar = !!absensi?.waktuKeluar;

  function formatWaktu(iso: string | undefined | null) {
    if (!iso) return "-";
    return format(new Date(iso), "HH:mm", { locale: idLocale });
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Date + name header */}
      <div className="rounded-2xl border bg-card p-5 text-center space-y-1">
        <div className="text-sm font-medium capitalize">
          {format(new Date(today + "T12:00:00"), "EEEE", { locale: idLocale })}
        </div>
        <div className="text-sm text-muted-foreground">
          {format(new Date(today + "T12:00:00"), "d MMMM yyyy", { locale: idLocale })}
        </div>
        {/* Profile photo */}
        <div className="mt-3 flex justify-center">
          {officer.profilePhotoUrl ? (
            <img
              src={officer.profilePhotoUrl}
              alt="Foto profil"
              className="size-20 rounded-full object-cover border-2 border-primary/20 shadow-sm"
            />
          ) : (
            <div className="size-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
              <User className="size-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="mt-2 text-2xl font-bold text-primary leading-tight">
          {officer.nama}
        </div>
        <div className="text-sm text-muted-foreground">{officer.jabatan}</div>
      </div>

      {/* Photo enrollment status */}
      {!isEnrolled ? (
        <div className="rounded-2xl border border-yellow-400/40 bg-yellow-50 dark:bg-yellow-900/20 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-300 text-sm">Foto profil belum diambil</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                Ambil foto profil Anda untuk bisa melakukan absensi mandiri.
              </p>
            </div>
          </div>
          <Button size="lg" className="w-full" onClick={() => setShowEnroll(true)}>
            <Camera className="size-5 mr-2" /> Ambil Foto Profil
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-green-500 shrink-0" />
            <span>Foto profil terdaftar</span>
            {officer.faceEnrolledAt && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                ({format(new Date(officer.faceEnrolledAt), "d MMM yyyy", { locale: idLocale })})
              </span>
            )}
          </div>
          <Button size="sm" variant="ghost" className="text-xs shrink-0" onClick={() => setConfirmClear(true)}>
            <RotateCcw className="size-3 mr-1" /> Ulang
          </Button>
        </div>
      )}

      {/* Today's assignment */}
      <NotificationToggle />
      {!assignment ? (
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          <Clock className="size-8 mx-auto mb-2 opacity-30" />
          Tidak ada jadwal shift hari ini.
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-4 space-y-4">
          {/* Shift info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="size-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm">{shift?.nama ?? "Shift"}</div>
              <div className="text-xs text-muted-foreground">{shift?.jamMulai} – {shift?.jamSelesai}</div>
              <BackupBadge row={{ ...assignment, linkedOfficerNama: data.linkedOfficerNama }} className="mt-1" />
            </div>
          </div>

          {assignment.berhalangan && (
            <div className="rounded-xl border border-rose-300/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
              Anda ditandai berhalangan hari ini. Shift Anda diambil alih oleh {data.linkedOfficerNama ?? "personel backup"}.
            </div>
          )}

          {assignment.pengingat && !hasMasuk && !assignment.berhalangan && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
              <BellRing className="size-4 shrink-0 mt-0.5" />
              Supervisor mengingatkan Anda untuk segera check-in ({formatWaktu(assignment.pengingat.waktu)}).
            </div>
          )}

          {/* Attendance status cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl border p-4 text-center ${hasMasuk ? "border-green-300 bg-green-50 dark:bg-green-900/20" : "border-dashed"}`}>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-2">
                <LogIn className="size-3" />
                Masuk
              </div>
              {hasMasuk ? (
                <>
                  <div className="text-lg font-bold text-green-600">{formatWaktu(absensi?.waktuMasuk)}</div>
                  {absensi?.isLate && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      +{absensi.keterlambatanMenit}m
                    </Badge>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground text-lg font-light">—</div>
              )}
            </div>
            <div className={`rounded-xl border p-4 text-center ${hasKeluar ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20" : "border-dashed"}`}>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-2">
                <LogOut className="size-3" />
                Keluar
              </div>
              {hasKeluar ? (
                <>
                  <div className="text-lg font-bold text-blue-600">{formatWaktu(absensi?.waktuKeluar)}</div>
                  {absensi?.isPulangCepat && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      Pulang cepat -{absensi.pulangCepatMenit}m
                    </Badge>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground text-lg font-light">—</div>
              )}
            </div>
          </div>

          {/* Foto thumbnails */}
          {(absensi?.fotoMasukUrl ?? absensi?.fotoKeluarUrl) && (
            <div className="flex gap-2">
              {absensi?.fotoMasukUrl && (
                <img src={absensi.fotoMasukUrl} alt="Foto masuk" className="size-16 rounded-xl object-cover border" />
              )}
              {absensi?.fotoKeluarUrl && (
                <img src={absensi.fotoKeluarUrl} alt="Foto keluar" className="size-16 rounded-xl object-cover border" />
              )}
            </div>
          )}

          {/* Action buttons — full-width stacked on mobile */}
          {isEnrolled && !assignment.berhalangan && (
            <div className="flex flex-col gap-2 pt-1">
              <Button
                size="lg"
                className="w-full h-14 text-base font-semibold"
                disabled={hasMasuk}
                onClick={() => setAbsenMode("masuk")}
              >
                <LogIn className="size-5 mr-2" />
                {hasMasuk ? "Sudah Absen Masuk" : "Absen Masuk"}
              </Button>
              <Button
                size="lg"
                className="w-full h-14 text-base font-semibold"
                variant="secondary"
                disabled={!hasMasuk || hasKeluar}
                onClick={() => setAbsenMode("keluar")}
              >
                <LogOut className="size-5 mr-2" />
                {hasKeluar ? "Sudah Absen Keluar" : "Absen Keluar"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* GPS note */}
      {assignment && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <MapPin className="size-3.5 shrink-0" />
          Lokasi GPS akan diverifikasi saat absensi. Pastikan GPS aktif.
        </div>
      )}
      <Dialog open={showEnroll} onOpenChange={(o) => !o && setShowEnroll(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ambil Foto Profil</DialogTitle>
          </DialogHeader>
          <FaceEnrollment onEnrolled={() => setShowEnroll(false)} />
        </DialogContent>
      </Dialog>

      {/* Absensi capture dialog */}
      <Dialog open={!!absenMode} onOpenChange={(o) => !o && setAbsenMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Absen {absenMode === "masuk" ? "Masuk" : "Keluar"}
            </DialogTitle>
          </DialogHeader>
          {absenMode && (
            <AbsensiCapture
              mode={absenMode}
              tanggal={today}
              onSuccess={() => setAbsenMode(null)}
              onCancel={() => setAbsenMode(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Clear enrollment confirm */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus foto profil?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda harus mengambil foto profil baru setelah ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                await clearEnrollment({ officerId: officer._id });
                toast.success("Foto profil dihapus");
              } catch { toast.error("Gagal"); }
              setConfirmClear(false);
            }}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AbsenMandiriPage() {
  return (
    <div>
      <PageHeader
        title="Absen Mandiri"
        description="Absensi masuk & keluar dengan foto selfie dan verifikasi lokasi."
      />
      <AuthLoading>
        <div className="max-w-sm mx-auto space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <User className="size-12 text-muted-foreground" />
          <p className="text-muted-foreground">Masuk untuk menggunakan absensi mandiri</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <AbsenMandiriContent />
      </Authenticated>
    </div>
  );
}
