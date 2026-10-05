import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { format, addDays, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Clock, ClipboardList, Pencil, Trash2, LogIn, SlidersHorizontal, Plus, MapPin, ChevronLeft, ChevronRight, UserCheck, Undo2 } from "lucide-react";
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
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { DateRangePicker } from "@/components/date-range-picker.tsx";
import AssignmentFormDialog from "./assignment-form-dialog.tsx";
import AbsensiFormDialog from "./absensi-form-dialog.tsx";
import { useRole } from "@/hooks/use-role.ts";
import BackupBadge from "@/components/backup-badge.tsx";
import BackupDialog from "./backup-dialog.tsx";

const STATUS_CONFIG = {
  hadir: { label: "Hadir", cls: "bg-green-600 text-white", border: "border-l-green-500", masukColor: "text-green-600 dark:text-green-400" },
  terlambat: { label: "Terlambat", cls: "bg-yellow-500 text-white", border: "border-l-yellow-400", masukColor: "text-yellow-600 dark:text-yellow-400" },
  izin: { label: "Izin", cls: "", border: "border-l-blue-400", masukColor: "text-blue-600" },
  sakit: { label: "Sakit", cls: "bg-blue-500 text-white", border: "border-l-blue-400", masukColor: "text-blue-600" },
  alpha: { label: "Alpha", cls: "bg-destructive text-white", border: "border-l-destructive", masukColor: "text-destructive" },
};

type AbsensiInfo = {
  status: "hadir" | "terlambat" | "izin" | "sakit" | "alpha";
  waktuMasuk?: string;
  waktuKeluar?: string;
  keterlambatanMenit?: number;
  isPulangCepat?: boolean;
  pulangCepatMenit?: number;
  keterangan?: string;
  fotoMasukUrl?: string | null;
  fotoKeluarUrl?: string | null;
  lokasiMasuk?: { lat: number; lng: number } | null;
};

type AssignmentRow = {
  _id: Id<"shiftAssignments">;
  officerId: Id<"officers">;
  shiftId: Id<"shifts">;
  siteId?: Id<"sites">;
  tanggal: string;
  catatan?: string;
  kode?: string;
  berhalangan?: { alasan: "sakit" | "izin" | "lainnya"; catatan?: string };
  backupInfo?: { menggantikanOfficerId: Id<"officers"> };
  linkedOfficerNama?: string | null;
  _creationTime: number;
  officer: { _id: Id<"officers">; nama: string; jabatan: string } | null;
  shift: { _id: Id<"shifts">; nama: string; jamMulai: string; jamSelesai: string; warnaTema?: string } | null;
  site: { _id: Id<"sites">; nama: string; kode: string } | null;
  absensi: AbsensiInfo | null;
};

function GeofenceIndicator({ row }: { row: AssignmentRow }) {
  const ab = row.absensi;
  if (!ab?.lokasiMasuk) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <MapPin className="size-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent>
          GPS: {ab.lokasiMasuk.lat.toFixed(5)}, {ab.lokasiMasuk.lng.toFixed(5)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type ShiftChip = "semua" | "pagi" | "malam" | "libur";

/** Backup assign / cancel button for a schedule row (MANAGE_OPS only). */
function BackupAction({
  row, compact, onAssign, onCancel,
}: {
  row: AssignmentRow;
  compact?: boolean;
  onAssign: (row: AssignmentRow) => void;
  onCancel: (row: AssignmentRow) => void;
}) {
  const size = compact ? "h-7 text-xs px-2" : "h-9 text-xs px-3";
  if (row.berhalangan || row.backupInfo) {
    return (
      <Button variant="ghost" size="sm" className={cn(size, "cursor-pointer text-rose-600 hover:text-rose-700")} onClick={() => onCancel(row)}>
        <Undo2 className="size-3.5" /> Batal Backup
      </Button>
    );
  }
  if (row.kode === "L" || row.absensi?.waktuMasuk) return null;
  return (
    <Button variant="ghost" size="sm" className={cn(size, "cursor-pointer text-amber-600 hover:text-amber-700")} onClick={() => onAssign(row)}>
      <UserCheck className="size-3.5" /> Backup
    </Button>
  );
}

export default function JadwalHarianTab() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  // Mobile: single-day navigator derived from dateFrom
  const [mobileDate, setMobileDate] = useState(today);
  const [filterShift, setFilterShift] = useState<ShiftChip>("semua");
  const [filterRegu, setFilterRegu] = useState<string>("semua");
  const [filterOpen, setFilterOpen] = useState(false);

  const assignments = useQuery(api.shifts.listAssignmentsRange, {
    tanggalMulai: dateFrom,
    tanggalSelesai: dateTo,
  });
  const mobileAssignments = useQuery(api.shifts.listAssignmentsRange, {
    tanggalMulai: mobileDate,
    tanggalSelesai: mobileDate,
  });
  const regus = useQuery(api.regu.listAktif, {});
  const deleteAssignment = useMutation(api.shifts.deleteAssignment);
  const { canManageOps, canManageSchedule } = useRole();

  const [formOpen, setFormOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<AssignmentRow | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"shiftAssignments"> | null>(null);
  const [absensiTarget, setAbsensiTarget] = useState<AssignmentRow | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [backupTarget, setBackupTarget] = useState<AssignmentRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AssignmentRow | null>(null);
  const cancelBackup = useMutation(api.backupShift.cancelBackup);

  const handleCancelBackup = async () => {
    if (!cancelTarget) return;
    try {
      await cancelBackup({ assignmentId: cancelTarget._id });
      toast.success("Backup dibatalkan, jadwal dikembalikan");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal membatalkan backup");
    } finally { setCancelTarget(null); }
  };

  // Desktop filtering
  const filtered = useMemo(() => {
    if (!assignments) return undefined;
    return (assignments as AssignmentRow[]).filter((row) => {
      if (filterShift !== "semua") {
        const nama = row.shift?.nama?.toLowerCase() ?? "";
        const kode = (row as AssignmentRow & { kode?: string }).kode?.toLowerCase() ?? "";
        if (filterShift === "libur" && kode !== "l") return false;
        if (filterShift === "pagi" && !nama.includes("pagi") && !kode.includes("p")) return false;
        if (filterShift === "malam" && !nama.includes("malam") && !kode.includes("m")) return false;
      }
      if (filterRegu !== "semua") {
        const officerReguId = (row as AssignmentRow & { officer: { reguId?: string } | null }).officer?.reguId;
        if (officerReguId !== filterRegu) return false;
      }
      return true;
    });
  }, [assignments, filterShift, filterRegu]);

  // Mobile filtering
  const mobileFiltered = useMemo(() => {
    if (!mobileAssignments) return undefined;
    return (mobileAssignments as AssignmentRow[]).filter((row) => {
      if (filterShift !== "semua") {
        const nama = row.shift?.nama?.toLowerCase() ?? "";
        const kode = (row as AssignmentRow & { kode?: string }).kode?.toLowerCase() ?? "";
        if (filterShift === "libur" && kode !== "l") return false;
        if (filterShift === "pagi" && !nama.includes("pagi") && !kode.includes("p")) return false;
        if (filterShift === "malam" && !nama.includes("malam") && !kode.includes("m")) return false;
      }
      if (filterRegu !== "semua") {
        const officerReguId = (row as AssignmentRow & { officer: { reguId?: string } | null }).officer?.reguId;
        if (officerReguId !== filterRegu) return false;
      }
      return true;
    });
  }, [mobileAssignments, filterShift, filterRegu]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAssignment({ assignmentId: deleteId });
      toast.success("Jadwal dihapus");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghapus");
    } finally { setDeleteId(null); }
  };

  const mobileDateLabel = format(parseISO(mobileDate), "EEEE, d MMM yyyy", { locale: localeId });

  const CHIPS: { value: ShiftChip; label: string }[] = [
    { value: "semua", label: "Semua" },
    { value: "pagi", label: "Pagi" },
    { value: "malam", label: "Malam" },
    { value: "libur", label: "Libur" },
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

        {/* Filter chips row */}
        <div className="flex flex-wrap gap-2 items-center">
          {CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilterShift(chip.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                filterShift === chip.value
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
            {canManageSchedule && (
              <button
                type="button"
                onClick={() => { setEditAssignment(null); setFormOpen(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground border border-primary hover:bg-primary/90 transition-colors"
              >
                <Plus className="size-3" /> Jadwalkan
              </button>
            )}
          </div>
        </div>

        {/* Collapsible filter panel */}
        {filterOpen && (
          <div className="rounded-xl border bg-card p-3 space-y-2">
            <DateRangePicker
              from={mobileDate}
              to={mobileDate}
              onChange={(f) => setMobileDate(f)}
            />
            <div className="flex gap-2">
              <Select value={filterShift} onValueChange={(v) => setFilterShift(v as ShiftChip)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Shift</SelectItem>
                  <SelectItem value="pagi">Pagi</SelectItem>
                  <SelectItem value="malam">Malam</SelectItem>
                  <SelectItem value="libur">Libur (L)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterRegu} onValueChange={setFilterRegu}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Regu</SelectItem>
                  {regus?.map((r) => (
                    <SelectItem key={r._id} value={r._id}>{r.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Summary */}
        {mobileFiltered !== undefined && (
          <p className="text-xs text-muted-foreground">Menampilkan {mobileFiltered.length} jadwal</p>
        )}

        {/* Cards */}
        {mobileFiltered === undefined ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
        ) : mobileFiltered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
              <EmptyTitle>Belum ada jadwal</EmptyTitle>
              <EmptyDescription>Belum ada petugas dijadwalkan pada tanggal ini</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {canManageSchedule && (
                <Button size="sm" onClick={() => { setEditAssignment(null); setFormOpen(true); }}>Jadwalkan Petugas</Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-3">
            {mobileFiltered.map((row) => {
              const ab = row.absensi;
              const sc = ab ? STATUS_CONFIG[ab.status] : null;
              return (
                <div
                  key={row._id}
                  className={cn(
                    "rounded-xl border-l-4 border border-border bg-card p-4 space-y-3 shadow-sm",
                    sc ? sc.border : "border-l-muted-foreground/30"
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[15px] font-semibold text-foreground leading-tight">{row.officer?.nama ?? "—"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{row.officer?.jabatan}</div>
                      <BackupBadge row={row} className="mt-1" />
                    </div>
                    {ab && sc ? (
                      <Badge className={cn(sc.cls, "shrink-0 text-[11px] font-semibold")}>
                        {sc.label}{ab.keterlambatanMenit ? ` +${ab.keterlambatanMenit}m` : ""}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground shrink-0 font-medium">Belum dicatat</span>
                    )}
                  </div>

                  {/* Shift row */}
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: row.shift?.warnaTema ?? "#6B7280" }} />
                    <span className="text-[13px] font-semibold text-foreground">{row.shift?.nama ?? "—"}</span>
                    {row.site && (
                      <Badge variant="secondary" className="text-[10px] font-semibold px-1.5 py-0">{row.site.kode}</Badge>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                      <Clock className="size-3 shrink-0" />
                      {row.shift?.jamMulai}–{row.shift?.jamSelesai}
                    </span>
                  </div>

                  {/* Masuk/keluar info */}
                  {ab?.waktuMasuk && sc && (
                    <div className={cn("flex items-center gap-1.5 text-[11px] font-semibold", sc.masukColor)}>
                      <LogIn className="size-3.5 shrink-0" />
                      Masuk {format(new Date(ab.waktuMasuk), "HH:mm")}
                      {ab.waktuKeluar && (
                        <span className="text-muted-foreground font-normal text-[11px]">
                          {" → "}{format(new Date(ab.waktuKeluar), "HH:mm")}
                        </span>
                      )}
                      {ab.isPulangCepat && (
                        <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">Pulang cepat</Badge>
                      )}
                      <GeofenceIndicator row={row} />
                    </div>
                  )}

                  {/* Foto thumbnails */}
                  {(ab?.fotoMasukUrl ?? ab?.fotoKeluarUrl) && (
                    <div className="flex gap-2">
                      {ab?.fotoMasukUrl && (
                        <button type="button" onClick={() => setPhotoPreview(ab.fotoMasukUrl!)}>
                          <img src={ab.fotoMasukUrl} alt="foto masuk" className="size-12 rounded-lg object-cover border" />
                        </button>
                      )}
                      {ab?.fotoKeluarUrl && (
                        <button type="button" onClick={() => setPhotoPreview(ab.fotoKeluarUrl!)}>
                          <img src={ab.fotoKeluarUrl} alt="foto keluar" className="size-12 rounded-lg object-cover border" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  <div className="h-px bg-border" />

                  {/* Actions */}
                  <div className="flex gap-2 items-center">
                    {canManageOps && (
                      <Button
                        size="sm"
                        className="flex-1 h-9 text-xs font-semibold"
                        variant={ab ? "secondary" : "default"}
                        onClick={() => setAbsensiTarget(row)}
                      >
                        {ab ? "Edit Absensi" : "Catat Absensi"}
                      </Button>
                    )}
                    {canManageOps && (
                      <BackupAction row={row} onAssign={setBackupTarget} onCancel={setCancelTarget} />
                    )}
                    {canManageSchedule && (
                      <>
                        <Button
                          variant="ghost" size="icon"
                          className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => { setEditAssignment(row); setFormOpen(true); }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="size-9 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(row._id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
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
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filterShift} onValueChange={(v) => setFilterShift(v as ShiftChip)}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Shift</SelectItem>
                <SelectItem value="pagi">Pagi</SelectItem>
                <SelectItem value="malam">Malam</SelectItem>
                <SelectItem value="libur">Libur (L)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRegu} onValueChange={setFilterRegu}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Regu</SelectItem>
                {regus?.map((r) => (
                  <SelectItem key={r._id} value={r._id}>{r.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManageSchedule && (
              <Button size="sm" onClick={() => { setEditAssignment(null); setFormOpen(true); }}>
                <Plus className="size-4" /> Jadwalkan Petugas
              </Button>
            )}
          </div>
        </div>

        {filtered !== undefined && (
          <p className="mb-2 text-xs text-muted-foreground">Menampilkan {filtered.length} jadwal</p>
        )}

        {filtered === undefined ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
              <EmptyTitle>Belum ada jadwal</EmptyTitle>
              <EmptyDescription>Belum ada petugas dijadwalkan pada tanggal ini</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {canManageSchedule && (
                <Button size="sm" onClick={() => { setEditAssignment(null); setFormOpen(true); }}>Jadwalkan Petugas</Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Petugas</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Absensi</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const ab = row.absensi;
                  const sc = ab ? STATUS_CONFIG[ab.status] : null;
                  return (
                    <TableRow key={row._id}>
                      <TableCell>
                        <div className="font-medium">{row.officer?.nama ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{row.officer?.jabatan}</div>
                        <BackupBadge row={row} className="mt-1" />
                        {dateFrom !== dateTo && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(row.tanggal + "T00:00:00"), "d MMM yyyy")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: row.shift?.warnaTema ?? "#6B7280" }} />
                          <span className="text-sm font-medium">{row.shift?.nama ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Clock className="size-3" />
                          {row.shift?.jamMulai}–{row.shift?.jamSelesai}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.site ? <Badge variant="secondary">{row.site.kode}</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        {ab ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <Badge className={sc?.cls}>{sc?.label}</Badge>
                              <GeofenceIndicator row={row} />
                            </div>
                            {!!ab.keterlambatanMenit && (
                              <div className="text-xs text-muted-foreground">+{ab.keterlambatanMenit} menit</div>
                            )}
                            {ab.isPulangCepat && (
                              <Badge className="bg-orange-500 text-white text-[10px]">
                                Pulang cepat -{ab.pulangCepatMenit}m
                              </Badge>
                            )}
                            {ab.waktuMasuk && (
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(ab.waktuMasuk), "HH:mm")}
                                {ab.waktuKeluar ? ` → ${format(new Date(ab.waktuKeluar), "HH:mm")}` : ""}
                              </div>
                            )}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">Belum dicatat</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {ab?.fotoMasukUrl && (
                            <button type="button" onClick={() => setPhotoPreview(ab.fotoMasukUrl!)}>
                              <img src={ab.fotoMasukUrl} alt="foto masuk" className="size-8 rounded object-cover border hover:opacity-80 cursor-pointer" />
                            </button>
                          )}
                          {ab?.fotoKeluarUrl && (
                            <button type="button" onClick={() => setPhotoPreview(ab.fotoKeluarUrl!)}>
                              <img src={ab.fotoKeluarUrl} alt="foto keluar" className="size-8 rounded object-cover border hover:opacity-80 cursor-pointer" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {canManageOps && (
                            <>
                              <BackupAction row={row} compact onAssign={setBackupTarget} onCancel={setCancelTarget} />
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setAbsensiTarget(row)}>Absen</Button>
                            </>
                          )}
                          {canManageSchedule && (
                            <>
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditAssignment(row); setFormOpen(true); }}><Pencil className="size-4" /></Button>
                              <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(row._id)}><Trash2 className="size-4" /></Button>
                            </>
                          )}
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

      <AssignmentFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditAssignment(null); }}
        defaultDate={dateTo}
        editAssignment={editAssignment}
      />

      {absensiTarget && (
        <AbsensiFormDialog
          open={!!absensiTarget}
          onClose={() => setAbsensiTarget(null)}
          assignmentId={absensiTarget._id}
          siteId={absensiTarget.siteId}
          officerNama={absensiTarget.officer?.nama ?? "—"}
          shiftNama={absensiTarget.shift?.nama ?? "—"}
          shiftJamMulai={absensiTarget.shift?.jamMulai ?? "00:00"}
          tanggal={absensiTarget.tanggal}
          existingAbsensi={absensiTarget.absensi}
        />
      )}

      {backupTarget && (
        <BackupDialog
          target={{
            _id: backupTarget._id,
            officerNama: backupTarget.officer?.nama ?? "Personel",
            shiftLabel: `${backupTarget.shift?.nama ?? "shift"} (${backupTarget.shift?.jamMulai ?? ""}–${backupTarget.shift?.jamSelesai ?? ""})`,
            tanggal: format(parseISO(backupTarget.tanggal), "d MMM yyyy", { locale: localeId }),
          }}
          onClose={() => setBackupTarget(null)}
        />
      )}

      <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Jadwal personel utama dan personel backup dikembalikan seperti semula.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Tidak</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelBackup} className="cursor-pointer bg-destructive text-white hover:bg-destructive/90">Batalkan Backup</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jadwal?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {photoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPhotoPreview(null)}
        >
          <img src={photoPreview} alt="Foto absensi" className="max-h-[80vh] max-w-[90vw] rounded-lg shadow-xl" />
        </div>
      )}
    </div>
  );
}