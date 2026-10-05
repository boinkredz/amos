import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { format, addDays, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ClipboardList, Pencil, Trash2, Plus, Clock, MapPin, ChevronRight, ChevronLeft, SlidersHorizontal } from "lucide-react";
import { DateRangePicker } from "@/components/date-range-picker.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import PenugasanFormDialog, { type PenugasanEditData } from "./penugasan-form-dialog.tsx";

type TugasRow = {
  _id: Id<"tugasPatroli">;
  ruteId: Id<"rutePatroli">;
  officerId: Id<"officers">;
  tanggal: string;
  jamMulaiRencana: string;
  jamSelesaiRencana: string;
  status: "dijadwalkan" | "berlangsung" | "selesai" | "dibatalkan";
  waktuMulai?: string;
  waktuSelesai?: string;
  catatan?: string;
  _creationTime: number;
  rute: { _id: string; nama: string } | null;
  officer: { _id: string; nama: string; jabatan: string } | null;
  totalCheckpoints: number;
  checkpointsDikunjungi: number;
};

const STATUS_CONFIG = {
  dijadwalkan: { label: "Dijadwalkan", cls: "bg-secondary text-secondary-foreground", border: "border-l-border" },
  berlangsung: { label: "Berlangsung", cls: "bg-blue-600 text-white", border: "border-l-blue-500" },
  selesai: { label: "Selesai", cls: "bg-green-600 text-white", border: "border-l-green-500" },
  dibatalkan: { label: "Dibatalkan", cls: "bg-destructive text-white", border: "border-l-destructive" },
};

type StatusFilter = "semua" | "dijadwalkan" | "berlangsung" | "selesai" | "dibatalkan";

function todayString() { return format(new Date(), "yyyy-MM-dd"); }

export default function PenugasanTab() {
  const today = todayString();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [mobileDate, setMobileDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [filterOpen, setFilterOpen] = useState(false);
  const navigate = useNavigate();

  const tugas = useQuery(api.patroli.listTugasRange, {
    tanggalMulai: dateFrom,
    tanggalSelesai: dateTo,
  });
  const mobileTugas = useQuery(api.patroli.listTugasRange, {
    tanggalMulai: mobileDate,
    tanggalSelesai: mobileDate,
  });
  const deleteTugas = useMutation(api.patroli.deleteTugas);

  const [formOpen, setFormOpen] = useState(false);
  const [editPenugasan, setEditPenugasan] = useState<PenugasanEditData | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"tugasPatroli"> | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTugas({ tugasId: deleteId });
      toast.success("Penugasan dihapus");
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghapus",
      );
    } finally { setDeleteId(null); }
  };

  const openEdit = (row: TugasRow) => {
    setEditPenugasan({
      _id: row._id,
      officerId: row.officerId,
      ruteId: row.ruteId,
      tanggal: row.tanggal,
      jamMulaiRencana: row.jamMulaiRencana,
      jamSelesaiRencana: row.jamSelesaiRencana,
      catatan: row.catatan,
    });
    setFormOpen(true);
  };

  const mobileFiltered = mobileTugas
    ? (mobileTugas as TugasRow[]).filter((r) => statusFilter === "semua" || r.status === statusFilter)
    : undefined;

  const mobileDateLabel = format(parseISO(mobileDate), "EEEE, d MMM yyyy", { locale: idLocale });

  const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
    { value: "semua", label: "Semua" },
    { value: "dijadwalkan", label: "Dijadwalkan" },
    { value: "berlangsung", label: "Aktif" },
    { value: "selesai", label: "Selesai" },
  ];

  return (
    <div>
      {/* ── MOBILE LAYOUT ── */}
      <div className="md:hidden space-y-3">
        {/* Date navigator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Hari sebelumnya"
            onClick={() => setMobileDate(format(addDays(parseISO(mobileDate), -1), "yyyy-MM-dd"))}
            className="size-9 flex items-center justify-center rounded-lg border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex-1 text-center text-sm font-semibold text-foreground border rounded-lg bg-card py-2 px-3">
            {mobileDateLabel}
          </div>
          <button
            type="button"
            aria-label="Hari berikutnya"
            onClick={() => setMobileDate(format(addDays(parseISO(mobileDate), 1), "yyyy-MM-dd"))}
            className="size-9 flex items-center justify-center rounded-lg border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 items-center">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setStatusFilter(chip.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                statusFilter === chip.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {chip.label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                filterOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              <SlidersHorizontal className="size-3" /> Filter
            </button>
            <button
              type="button"
              onClick={() => { setEditPenugasan(null); setFormOpen(true); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground border border-primary hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-3" /> Jadwalkan
            </button>
          </div>
        </div>

        {/* Collapsible filter panel */}
        {filterOpen && (
          <div className="rounded-xl border bg-card p-3">
            <DateRangePicker
              from={mobileDate}
              to={mobileDate}
              onChange={(f) => setMobileDate(f)}
            />
          </div>
        )}

        {/* Summary */}
        {mobileFiltered !== undefined && (
          <p className="text-xs text-muted-foreground">Menampilkan {mobileFiltered.length} patroli</p>
        )}

        {/* Cards */}
        {mobileFiltered === undefined ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
        ) : mobileFiltered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
              <EmptyTitle>Belum ada jadwal patroli</EmptyTitle>
              <EmptyDescription>Belum ada tugas patroli dijadwalkan untuk tanggal ini.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={() => { setEditPenugasan(null); setFormOpen(true); }}>Jadwalkan Patroli</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-3">
            {mobileFiltered.map((row) => {
              const sc = STATUS_CONFIG[row.status];
              const pct = row.totalCheckpoints > 0
                ? Math.round((row.checkpointsDikunjungi / row.totalCheckpoints) * 100) : 0;
              return (
                <div key={row._id} className={cn(
                  "rounded-xl border-l-4 border border-border bg-card p-4 space-y-3 shadow-sm",
                  sc.border
                )}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[15px] font-semibold text-foreground leading-tight">{row.officer?.nama ?? "—"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{row.officer?.jabatan}</div>
                    </div>
                    <Badge className={cn(sc.cls, "shrink-0 text-[11px] font-semibold")}>{sc.label}</Badge>
                  </div>

                  {/* Rute & waktu */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-[13px] font-semibold text-foreground">{row.rute?.nama ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                      <Clock className="size-3.5 shrink-0" />
                      <span>{row.jamMulaiRencana}–{row.jamSelesaiRencana}</span>
                    </div>
                  </div>

                  {/* Progress */}
                  {row.totalCheckpoints > 0 && (
                    <div className="space-y-1">
                      <Progress value={pct} className="h-1.5" />
                      <div className="text-[11px] text-muted-foreground font-medium">
                        {row.checkpointsDikunjungi}/{row.totalCheckpoints} checkpoint ({pct}%)
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="h-px bg-border" />

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm" className="flex-1 h-9 text-xs font-semibold"
                      onClick={() => navigate(`/patroli/tugas/${row._id}`)}
                    >
                      <ChevronRight className="size-4 mr-1" /> Detail
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(row)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="size-9 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(row._id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden md:block">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
          />
          <Button size="sm" onClick={() => { setEditPenugasan(null); setFormOpen(true); }}>
            <Plus className="size-4" /> Jadwalkan Patroli
          </Button>
        </div>

        {tugas === undefined ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : tugas.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
              <EmptyTitle>Belum ada jadwal patroli</EmptyTitle>
              <EmptyDescription>Belum ada tugas patroli dijadwalkan untuk tanggal ini.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={() => { setEditPenugasan(null); setFormOpen(true); }}>Jadwalkan Patroli</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Petugas</TableHead>
                  <TableHead>Rute</TableHead>
                  <TableHead>Jam Rencana</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tugas as TugasRow[]).map((row) => {
                  const sc = STATUS_CONFIG[row.status];
                  const pct = row.totalCheckpoints > 0
                    ? Math.round((row.checkpointsDikunjungi / row.totalCheckpoints) * 100) : 0;
                  return (
                    <TableRow key={row._id}>
                      <TableCell>
                        <div className="font-medium">{row.officer?.nama ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{row.officer?.jabatan}</div>
                        {dateFrom !== dateTo && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(row.tanggal + "T00:00:00"), "d MMM yyyy")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{row.rute?.nama ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="size-3" />
                          {row.jamMulaiRencana}–{row.jamSelesaiRencana}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.totalCheckpoints > 0 ? (
                          <div className="min-w-[100px] space-y-1">
                            <Progress value={pct} className="h-1.5" />
                            <div className="text-xs text-muted-foreground">
                              {row.checkpointsDikunjungi}/{row.totalCheckpoints} checkpoint
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={sc.cls}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="secondary" size="sm"
                            className="h-7 cursor-pointer gap-1 text-xs"
                            onClick={() => navigate(`/patroli/tugas/${row._id}`)}
                          >
                            Mulai
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 cursor-pointer" onClick={() => openEdit(row)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="size-7 cursor-pointer text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(row._id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <PenugasanFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditPenugasan(null); }}
        defaultTanggal={dateTo}
        editPenugasan={editPenugasan}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Penugasan?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
