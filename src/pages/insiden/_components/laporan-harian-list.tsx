import { useState } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { useRole } from "@/hooks/use-role.ts";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Plus, ClipboardList, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import LaporanHarianFormDialog from "./laporan-harian-form-dialog.tsx";
import LaporanHarianDetailPanel from "./laporan-harian-detail-panel.tsx";

export default function LaporanHarianList() {
  const { isAdmin, canManageOps } = useRole();
  const { results, status, loadMore } = usePaginatedQuery(
    api.insiden.listLaporanHarian,
    {},
    { initialNumItems: 20 },
  );
  const deleteLaporan = useMutation(api.insiden.deleteLaporanHarian);

  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<"laporanHarian"> | null>(null);

  const handleDelete = async (laporanId: Id<"laporanHarian">, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Hapus Laporan Harian ini?")) return;
    try {
      await deleteLaporan({ laporanId });
      toast.success("Laporan Harian dihapus");
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
      {canManageOps && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-primary text-primary-foreground border border-primary hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="size-4" /> Buat Laporan Harian
          </button>
        </div>
      )}

      {results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyTitle>Belum ada Laporan Harian</EmptyTitle>
            <EmptyDescription>Buat laporan harian untuk mencatat kondisi shift.</EmptyDescription>
          </EmptyHeader>
          {canManageOps && (
            <EmptyContent>
              <Button size="sm" className="cursor-pointer" onClick={() => setShowForm(true)}>Buat Laporan</Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-3">
          {results.map((l) => {
            const isLengkap = l.statusKehadiran === "lengkap";
            return (
              <div
                key={l._id}
                onClick={() => setSelectedId(l._id)}
                className={cn(
                  "rounded-xl border-l-4 border border-border bg-card p-4 shadow-sm cursor-pointer hover:bg-accent/30 transition-colors space-y-2",
                  isLengkap ? "border-l-green-500" : "border-l-destructive"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-foreground">
                        {format(new Date(l.tanggal), "d MMM yyyy", { locale: id })}
                      </span>
                      <Badge variant="secondary" className="text-[10px] font-semibold">{l.shift}</Badge>
                      <Badge
                        variant={isLengkap ? "default" : "destructive"}
                        className="text-[10px] font-semibold"
                      >
                        {isLengkap ? "Lengkap" : "Tidak Lengkap"}
                      </Badge>
                    </div>
                    <div className="text-[12px] text-muted-foreground font-medium">
                      {l.lokasiGedung} — {l.namaPembuat}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-normal">
                      Personil: {l.personilHadir}/{l.personilHarusnya}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin && (
                      <button
                        type="button"
                        className="size-8 flex items-center justify-center rounded-lg text-destructive hover:bg-muted transition-colors"
                        onClick={(e) => handleDelete(l._id, e)}
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
            <Button variant="secondary" className="w-full cursor-pointer" onClick={() => loadMore(20)}>
              Muat lebih banyak
            </Button>
          )}
          {status === "LoadingMore" && <Skeleton className="h-10 w-full" />}
        </div>
      )}

      <LaporanHarianFormDialog open={showForm} onClose={() => setShowForm(false)} />
      {selectedId && (
        <LaporanHarianDetailPanel laporanId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
