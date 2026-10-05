import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Plus, Pencil, Trash2, MapPinned, Flag } from "lucide-react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription,
} from "@/components/ui/empty.tsx";
import CheckpointFormDialog, { type CheckpointEditData } from "./checkpoint-form-dialog.tsx";

type CheckpointRow = {
  _id: Id<"checkpoint">;
  ruteId: Id<"rutePatroli">;
  nama: string;
  urutan: number;
  deskripsi?: string;
  koordinat?: { lat: number; lng: number };
  _creationTime: number;
};

export default function CheckpointTab() {
  const [ruteId, setRuteId] = useState<Id<"rutePatroli"> | null>(null);
  const rutes = useQuery(api.patroli.listRute, {});
  const checkpoints = useQuery(
    api.patroli.listCheckpoints,
    ruteId ? { ruteId } : "skip",
  );
  const deleteCp = useMutation(api.patroli.deleteCheckpoint);

  const [formOpen, setFormOpen] = useState(false);
  const [editCp, setEditCp] = useState<CheckpointEditData | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"checkpoint"> | null>(null);

  const nextUrutan = checkpoints ? checkpoints.length + 1 : 1;

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCp({ checkpointId: deleteId });
      toast.success("Checkpoint dihapus");
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghapus",
      );
    } finally {
      setDeleteId(null);
    }
  };

  const openAdd = () => { setEditCp(null); setFormOpen(true); };
  const openEdit = (cp: CheckpointRow) => {
    setEditCp({
      _id: cp._id,
      nama: cp.nama,
      urutan: cp.urutan,
      deskripsi: cp.deskripsi,
      koordinat: cp.koordinat,
    });
    setFormOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select
          value={ruteId ?? ""}
          onValueChange={(v) => setRuteId(v as Id<"rutePatroli">)}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Pilih rute patroli..." />
          </SelectTrigger>
          <SelectContent>
            {rutes?.map((r) => (
              <SelectItem key={r._id} value={r._id}>{r.nama}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openAdd} disabled={!ruteId} className="cursor-pointer">
          <Plus className="size-4" /> Tambah Checkpoint
        </Button>
      </div>

      {!ruteId ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><MapPinned /></EmptyMedia>
            <EmptyTitle>Pilih rute terlebih dahulu</EmptyTitle>
            <EmptyDescription>Pilih rute patroli untuk melihat dan mengelola checkpoint-nya.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : checkpoints === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : checkpoints.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Flag /></EmptyMedia>
            <EmptyTitle>Belum ada checkpoint</EmptyTitle>
            <EmptyDescription>Tambahkan checkpoint untuk rute ini.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No</TableHead>
                <TableHead>Nama Checkpoint</TableHead>
                <TableHead>Koordinat</TableHead>
                <TableHead className="w-40 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(checkpoints as CheckpointRow[]).map((cp) => (
                <TableRow key={cp._id}>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">#{cp.urutan}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{cp.nama}</div>
                    {cp.deskripsi && (
                      <div className="text-xs text-muted-foreground line-clamp-1">{cp.deskripsi}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cp.koordinat
                      ? `${cp.koordinat.lat.toFixed(5)}, ${cp.koordinat.lng.toFixed(5)}`
                      : "Belum diset"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7 cursor-pointer" onClick={() => openEdit(cp)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="size-7 cursor-pointer text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(cp._id)}
                      >
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

      {ruteId && (
        <CheckpointFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditCp(null); }}
          ruteId={ruteId}
          defaultUrutan={nextUrutan}
          editCheckpoint={editCp}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Checkpoint?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
