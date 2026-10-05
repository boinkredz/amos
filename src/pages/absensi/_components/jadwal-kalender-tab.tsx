import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, parseISO, addMonths, subMonths } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import AssignmentFormDialog from "./assignment-form-dialog.tsx";
import BackupBadge from "@/components/backup-badge.tsx";

type AssignmentRow = {
  _id: Id<"shiftAssignments">;
  officerId: Id<"officers">;
  shiftId: Id<"shifts">;
  siteId?: Id<"sites">;
  tanggal: string;
  catatan?: string;
  berhalangan?: { alasan: "sakit" | "izin" | "lainnya"; catatan?: string };
  backupInfo?: { menggantikanOfficerId: Id<"officers"> };
  linkedOfficerNama?: string | null;
  _creationTime: number;
  officer: { _id: Id<"officers">; nama: string; jabatan: string } | null;
  shift: { _id: Id<"shifts">; nama: string; jamMulai: string; jamSelesai: string; warnaTema?: string } | null;
};

export default function JadwalKalenderTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [filterShift, setFilterShift] = useState<"semua" | "pagi" | "malam" | "libur">("semua");
  const [filterRegu, setFilterRegu] = useState<string>("semua");
  const [formOpen, setFormOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<AssignmentRow | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"shiftAssignments"> | null>(null);

  const sites = useQuery(api.sites.list, { aktifOnly: true });
  const regus = useQuery(api.regu.listAktif, {});

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const rangeStart = format(calStart, "yyyy-MM-dd");
  const rangeEnd = format(calEnd, "yyyy-MM-dd");

  const assignments = useQuery(api.shifts.listAssignmentsRange, {
    tanggalMulai: rangeStart,
    tanggalSelesai: rangeEnd,
    siteId: siteFilter !== "all" ? (siteFilter as Id<"sites">) : undefined,
  });

  const deleteAssignment = useMutation(api.shifts.deleteAssignment);

  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Group assignments by date (with filter applied)
  const byDate = useMemo(() => {
    const map: Record<string, AssignmentRow[]> = {};
    if (!assignments) return map;
    for (const a of assignments as AssignmentRow[]) {
      // Shift filter
      if (filterShift !== "semua") {
        const nama = a.shift?.nama?.toLowerCase() ?? "";
        const kode = (a as AssignmentRow & { kode?: string }).kode?.toLowerCase() ?? "";
        if (filterShift === "libur" && kode !== "l") continue;
        if (filterShift === "pagi" && !nama.includes("pagi") && !kode.includes("p")) continue;
        if (filterShift === "malam" && !nama.includes("malam") && !kode.includes("m")) continue;
      }
      // Regu filter
      if (filterRegu !== "semua") {
        const officerReguId = (a as AssignmentRow & { officer: { reguId?: string } | null }).officer?.reguId;
        if (officerReguId !== filterRegu) continue;
      }
      if (!map[a.tanggal]) map[a.tanggal] = [];
      map[a.tanggal].push(a);
    }
    return map;
  }, [assignments, filterShift, filterRegu]);

  const selectedAssignments = selectedDate ? (byDate[selectedDate] ?? []) : [];

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAssignment({ assignmentId: deleteId });
      toast.success("Jadwal dihapus");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghapus");
    } finally { setDeleteId(null); }
  };

  const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[160px] text-center text-sm font-semibold capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: idLocale })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCurrentMonth(new Date())}>
            Bulan Ini
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Site</SelectItem>
              {sites?.map((s) => (
                <SelectItem key={s._id} value={s._id}>{s.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterShift} onValueChange={(v) => setFilterShift(v as typeof filterShift)}>
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
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Regu</SelectItem>
              {regus?.map((r) => (
                <SelectItem key={r._id} value={r._id}>{r.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setEditAssignment(null); setFormOpen(true); }}>
            <Plus className="size-4" /> Jadwalkan
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {assignments === undefined ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayAssignments = byDate[dateStr] ?? [];
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(selectedDate === dateStr ? null : dateStr)}
                  className={cn(
                    "min-h-[90px] border-b border-r p-1.5 cursor-pointer transition-colors last:border-r-0",
                    !inMonth && "bg-muted/20 opacity-50",
                    selectedDate === dateStr && "bg-accent/10",
                    "hover:bg-muted/30",
                  )}
                >
                  <div className={cn(
                    "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium",
                    today && "bg-primary text-primary-foreground",
                    !today && "text-foreground",
                  )}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayAssignments.slice(0, 3).map((a) => (
                      <div
                        key={a._id}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px] font-medium text-white",
                          a.berhalangan && "line-through opacity-60",
                          a.backupInfo && "ring-1 ring-amber-400",
                        )}
                        style={{ backgroundColor: a.shift?.warnaTema ?? "#6B7280" }}
                        title={`${a.officer?.nama} — ${a.shift?.nama}${a.berhalangan ? " (berhalangan)" : ""}${a.backupInfo ? " (backup)" : ""}`}
                      >
                        {a.backupInfo ? "B · " : ""}{a.officer?.nama?.split(" ")[0]}
                      </div>
                    ))}
                    {dayAssignments.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        +{dayAssignments.length - 3} lagi
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Day detail sheet */}
      <Sheet open={!!selectedDate} onOpenChange={(v) => !v && setSelectedDate(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="capitalize">
              {selectedDate
                ? format(parseISO(selectedDate + "T00:00:00"), "EEEE, d MMMM yyyy", { locale: idLocale })
                : ""}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedAssignments.length} petugas dijadwalkan
              </span>
              <Button size="sm" onClick={() => { setEditAssignment(null); setFormOpen(true); }}>
                <Plus className="size-4" /> Tambah
              </Button>
            </div>

            {selectedAssignments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada jadwal pada hari ini
              </p>
            ) : (
              selectedAssignments.map((a) => (
                <div key={a._id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{a.officer?.nama ?? "—"}</div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="size-7"
                        onClick={() => { setEditAssignment(a); setFormOpen(true); }}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(a._id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: a.shift?.warnaTema ?? "#6B7280" }}
                    />
                    <Badge variant="secondary" className="text-xs">
                      {a.shift?.nama} · {a.shift?.jamMulai}–{a.shift?.jamSelesai}
                    </Badge>
                  </div>
                  <BackupBadge row={a} />
                  {a.catatan && (
                    <p className="text-xs text-muted-foreground">{a.catatan}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AssignmentFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditAssignment(null); }}
        defaultDate={selectedDate ?? undefined}
        editAssignment={editAssignment}
      />

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
    </div>
  );
}
