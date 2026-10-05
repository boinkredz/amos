import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, FileText, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { formatRupiah } from "@/lib/utils.ts";
import { ConvexError } from "convex/values";

export default function RekapGajiTab({ periode }: { periode: string }) {
  const { canManageOps } = useRole();
  const isFinance = canManageOps;

  const rekaps = useQuery(api.keuangan.listRekap, isFinance ? { periode } : "skip");
  const myRekap = useQuery(api.keuangan.getMyRekap, !isFinance ? { periode } : "skip");

  const generateAllMutation = useMutation(api.keuangan.generateRekapAllOfficers);
  const finalisasiMutation = useMutation(api.keuangan.finalisasiRekap);
  const batalMutation = useMutation(api.keuangan.batalFinalisasi);

  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [confirmFinalisasi, setConfirmFinalisasi] = useState<Id<"rekapGaji"> | null>(null);
  const [expandedId, setExpandedId] = useState<Id<"rekapGaji"> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleGenerateAll() {
    setLoadingGenerate(true);
    try {
      const result = await generateAllMutation({ periode });
      toast.success(`Generate selesai: ${result.sukses} sukses, ${result.gagal} gagal`);
    } catch (err) {
      const msg = err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal generate";
      toast.error(msg);
    } finally {
      setLoadingGenerate(false);
    }
  }

  async function handleFinalisasi(id: Id<"rekapGaji">) {
    setActionLoading(id);
    try {
      await finalisasiMutation({ rekapId: id });
      toast.success("Rekap difinalisasi");
    } catch { toast.error("Gagal"); } finally { setActionLoading(null); setConfirmFinalisasi(null); }
  }

  async function handleBatalFinalisasi(id: Id<"rekapGaji">) {
    setActionLoading(id + "_batal");
    try {
      await batalMutation({ rekapId: id });
      toast.success("Finalisasi dibatalkan");
    } catch { toast.error("Gagal"); } finally { setActionLoading(null); }
  }

  if (!isFinance) {
    // Personal slip view
    if (myRekap === undefined) return <Skeleton className="h-48 w-full" />;
    if (!myRekap) return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><FileText /></EmptyMedia>
          <EmptyTitle>Slip gaji belum tersedia</EmptyTitle>
          <EmptyDescription>Rekap gaji periode ini belum digenerate</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
    return <RekapCard rekap={myRekap} expanded showOfficerName={false} onToggle={() => {}} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Rekap Gaji — {periode}
        </h3>
        <Button size="sm" onClick={handleGenerateAll} disabled={loadingGenerate}>
          <RefreshCw className={`size-4 mr-1 ${loadingGenerate ? "animate-spin" : ""}`} />
          {loadingGenerate ? "Memproses..." : "Generate Semua"}
        </Button>
      </div>

      {rekaps === undefined ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : rekaps.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileText /></EmptyMedia>
            <EmptyTitle>Belum ada rekap</EmptyTitle>
            <EmptyDescription>Klik "Generate Semua" untuk membuat rekap gaji periode ini</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={handleGenerateAll} disabled={loadingGenerate}>Generate Semua</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {rekaps.map((r) => (
            <div key={r._id}>
              <RekapCard
                rekap={r}
                expanded={expandedId === r._id}
                showOfficerName
                onToggle={() => setExpandedId(expandedId === r._id ? null : r._id)}
                extraActions={
                  <div className="flex gap-2 mt-3">
                    {r.status === "draft" ? (
                      <Button size="sm" onClick={() => setConfirmFinalisasi(r._id)}>
                        <Lock className="size-3.5 mr-1" /> Finalisasi
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => handleBatalFinalisasi(r._id)} disabled={actionLoading === r._id + "_batal"}>
                        <Unlock className="size-3.5 mr-1" /> Batal Finalisasi
                      </Button>
                    )}
                  </div>
                }
              />
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmFinalisasi} onOpenChange={(o) => !o && setConfirmFinalisasi(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalisasi Rekap Gaji?</AlertDialogTitle>
            <AlertDialogDescription>Setelah difinalisasi, rekap tidak bisa diubah kecuali admin membatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmFinalisasi && handleFinalisasi(confirmFinalisasi)}>
              Finalisasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RekapCard({
  rekap,
  expanded,
  showOfficerName,
  onToggle,
  extraActions,
}: {
  rekap: {
    _id: Id<"rekapGaji">;
    status: string;
    totalPemasukan: number;
    totalPotongan: number;
    gajiBersih: number;
    officerNama?: string;
    breakdown: {
      gajiPokok: number; tunjangan: number; bonusBackup: number; jumlahBackup: number;
      dendaTerlambat: number; menitTerlambat: number; cicilanKasbon: number;
      jumlahTerlambat?: number; dendaPulangCepat?: number; jumlahPulangCepat?: number;
      bpjs: number; pajak: number; potonganManual: number; tambahanManual: number;
    };
  };
  expanded: boolean;
  showOfficerName: boolean;
  onToggle: () => void;
  extraActions?: React.ReactNode;
}) {
  const b = rekap.breakdown;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="space-y-0.5">
          {showOfficerName && <div className="font-medium">{rekap.officerNama}</div>}
          <div className="text-sm font-semibold text-green-600">{formatRupiah(rekap.gajiBersih)}</div>
          <div className="text-xs text-muted-foreground">
            +{formatRupiah(rekap.totalPemasukan)} / -{formatRupiah(rekap.totalPotongan)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={rekap.status === "final" ? "default" : "secondary"}>
            {rekap.status === "final" ? <CheckCircle2 className="size-3 mr-1" /> : null}
            {rekap.status === "final" ? "Final" : "Draft"}
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            <DetailRow label="Gaji Pokok" value={formatRupiah(b.gajiPokok)} />
            <DetailRow label="Tunjangan" value={formatRupiah(b.tunjangan)} />
            <DetailRow label={`Bonus Backup (${b.jumlahBackup}x)`} value={formatRupiah(b.bonusBackup)} />
            {b.tambahanManual > 0 && <DetailRow label="Tambahan Manual" value={formatRupiah(b.tambahanManual)} />}
          </div>
          <div className="border-t pt-2 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            <DetailRow
              label={b.jumlahTerlambat !== undefined ? `Denda Terlambat (${b.jumlahTerlambat}x)` : `Denda Terlambat (${b.menitTerlambat} mnt)`}
              value={formatRupiah(b.dendaTerlambat)}
              deduction
            />
            {b.dendaPulangCepat !== undefined && (
              <DetailRow label={`Denda Pulang Cepat (${b.jumlahPulangCepat ?? 0}x)`} value={formatRupiah(b.dendaPulangCepat)} deduction />
            )}
            <DetailRow label="Cicilan Kasbon" value={formatRupiah(b.cicilanKasbon)} deduction />
            <DetailRow label="BPJS" value={formatRupiah(b.bpjs)} deduction />
            <DetailRow label="Pajak" value={formatRupiah(b.pajak)} deduction />
            {b.potonganManual > 0 && <DetailRow label="Potongan Manual" value={formatRupiah(b.potonganManual)} deduction />}
          </div>
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Gaji Bersih</span>
            <span className="text-green-600">{formatRupiah(rekap.gajiBersih)}</span>
          </div>
          {extraActions}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, deduction }: { label: string; value: string; deduction?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={deduction ? "text-red-500" : "text-foreground"}>
        {deduction ? "−" : ""}{value}
      </span>
    </div>
  );
}
