import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
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
import ShiftFormDialog from "./shift-form-dialog.tsx";

type ShiftRow = {
  _id: Id<"shifts">;
  nama: string;
  jamMulai: string;
  jamSelesai: string;
  warnaTema?: string;
  keterangan?: string;
  _creationTime: number;
};

export default function ShiftTemplatesTab() {
  const shifts = useQuery(api.shifts.listShifts, {});
  const deleteShift = useMutation(api.shifts.deleteShift);

  const [formOpen, setFormOpen] = useState(false);
  const [editShift, setEditShift] = useState<ShiftRow | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"shifts"> | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteShift({ shiftId: deleteId });
      toast.success("Shift dihapus");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghapus");
    } finally { setDeleteId(null); }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Template Shift</h2>
        <Button size="sm" onClick={() => { setEditShift(null); setFormOpen(true); }}>
          <Plus className="size-4" /> Tambah Shift
        </Button>
      </div>

      {shifts === undefined ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : shifts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><CalendarClock /></EmptyMedia>
            <EmptyTitle>Belum ada shift</EmptyTitle>
            <EmptyDescription>Buat template shift terlebih dahulu</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => { setEditShift(null); setFormOpen(true); }}>Tambah Shift</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shift</TableHead>
                <TableHead>Jam Kerja</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift._id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: shift.warnaTema ?? "#6B7280" }}
                      />
                      <span className="font-medium">{shift.nama}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{shift.jamMulai}–{shift.jamSelesai}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{shift.keterangan ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => { setEditShift(shift); setFormOpen(true); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(shift._id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ShiftFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditShift(null); }} editShift={editShift} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Shift?</AlertDialogTitle>
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
