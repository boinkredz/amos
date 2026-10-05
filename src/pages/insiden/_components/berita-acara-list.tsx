import { useState } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { useRole } from "@/hooks/use-role.ts";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Plus, FileText, Trash2, ChevronRight, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import { JENIS_INSIDEN_LABELS } from "../_lib/constants.ts";
import type { JenisInsiden } from "@/convex/schema/insiden";
import BeritaAcaraFormDialog from "./berita-acara-form-dialog.tsx";
import BeritaAcaraDetailDialog from "./berita-acara-detail-dialog.tsx";

// Warna border berdasarkan jenis insiden
const JENIS_BORDER: Record<string, string> = {
  kehilangan: "border-l-amber-400",
  kerusakan_pengunjung: "border-l-orange-400",
  kekerasan: "border-l-destructive",
  kebakaran: "border-l-red-500",
  pencurian: "border-l-rose-500",
  vandalisme: "border-l-purple-500",
  pelanggaran_peraturan: "border-l-yellow-500",
  pelanggaran_anggota: "border-l-yellow-400",
  maintenance: "border-l-blue-400",
  kerusakan_fasilitas: "border-l-orange-400",
  gangguan_ketertiban: "border-l-red-400",
  kecelakaan: "border-l-red-600",
  akses_tidak_sah: "border-l-purple-400",
  gangguan_teknis: "border-l-slate-400",
  lainnya: "border-l-blue-400",
};

function getBorderColor(jenis: string) {
  return JENIS_BORDER[jenis] ?? "border-l-blue-400";
}

// Konfigurasi badge status
const STATUS_CONFIG = {
  menunggu: { label: "Menunggu", icon: Clock, variant: "secondary" as const, className: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400" },
  disetujui: { label: "Disetujui", icon: CheckCircle2, variant: "default" as const, className: "text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:text-green-400" },
  ditolak: { label: "Ditolak", icon: XCircle, variant: "destructive" as const, className: "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400" },
};

type StatusFilter = "" | "menunggu" | "disetujui" | "ditolak";

export default function BeritaAcaraList() {
  const { isAdmin } = useRole();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<"beritaAcara"> | null>(null);

  const { results, status, loadMore } = usePaginatedQuery(
    api.insiden.listBeritaAcara,
    { status: statusFilter || undefined },
    { initialNumItems: 20 },
  );
  const deleteBA = useMutation(api.insiden.deleteBeritaAcara);

  const handleDelete = async (baId: Id<"beritaAcara">, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Hapus Berita Acara ini?")) return;
    try {
      await deleteBA({ baId });
      toast.success("Berita Acara dihapus");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghapus");
    }
  };

  if (status === "LoadingFirstPage") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter chips */}
        {(["", "menunggu", "disetujui", "ditolak"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors",
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {s === "" ? "Semua" : STATUS_CONFIG[s].label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" /> Buat BA
        </button>
      </div>

      {results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileText /></EmptyMedia>
            <EmptyTitle>
              {statusFilter ? `Tidak ada BA ${STATUS_CONFIG[statusFilter].label.toLowerCase()}` : "Belum ada Berita Acara"}
            </EmptyTitle>
            <EmptyDescription>
              {statusFilter ? "Coba pilih filter lain" : "Buat berita acara pertama untuk mencatat insiden."}
            </EmptyDescription>
          </EmptyHeader>
          {!statusFilter && (
            <EmptyContent>
              <Button size="sm" className="cursor-pointer" onClick={() => setShowForm(true)}>
                Buat Berita Acara
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-3">
          {results.map((ba) => {
            const baStatus = ba.status ?? "menunggu";
            const statusCfg = STATUS_CONFIG[baStatus];
            const StatusIcon = statusCfg.icon;
            return (
              <div
                key={ba._id}
                onClick={() => setSelectedId(ba._id)}
                className={cn(
                  "rounded-xl border-l-4 border border-border bg-card p-4 shadow-sm cursor-pointer hover:bg-accent/30 active:bg-accent/50 transition-colors space-y-2",
                  getBorderColor(ba.jenisInsiden)
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[13px] font-bold text-foreground">{ba.nomorBA}</span>
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        {JENIS_INSIDEN_LABELS[ba.jenisInsiden as JenisInsiden] ?? ba.jenisInsiden}
                      </Badge>
                      {/* Status badge */}
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                        statusCfg.className
                      )}>
                        <StatusIcon className="size-2.5" />
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="text-[12px] text-muted-foreground font-medium">
                      {ba.lokasiGedung} — {format(new Date(ba.tanggal), "d MMM yyyy", { locale: id })}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-normal">Petugas: {ba.petugasNama}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin && (
                      <button
                        type="button"
                        className="size-8 flex items-center justify-center rounded-lg text-destructive hover:bg-muted transition-colors"
                        onClick={(e) => handleDelete(ba._id, e)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            );
          })}

          {status === "CanLoadMore" && (
            <Button variant="secondary" className="w-full cursor-pointer text-[12px] font-semibold" onClick={() => loadMore(20)}>
              Muat lebih banyak
            </Button>
          )}
          {status === "LoadingMore" && <Skeleton className="h-10 w-full" />}
        </div>
      )}

      <BeritaAcaraFormDialog open={showForm} onClose={() => setShowForm(false)} />
      {selectedId && (
        <BeritaAcaraDetailDialog baId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
