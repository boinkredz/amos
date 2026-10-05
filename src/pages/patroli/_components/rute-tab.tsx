import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Route, Plus, Pencil, Trash2, MapPin, Clock, Flag } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import RuteFormDialog, { type RuteEditData } from "./rute-form-dialog.tsx";

const ALL_SITES = "all";

type RuteRow = {
  _id: Id<"rutePatroli">;
  nama: string;
  siteId?: Id<"sites">;
  estimasiMenit: number;
  keterangan?: string;
  aktif: boolean;
  _creationTime: number;
  jumlahCheckpoint: number;
  site: { _id: Id<"sites">; nama: string; kode: string } | null;
};

type Props = {
  onLihatCheckpoint: () => void;
};

export default function RuteTab({ onLihatCheckpoint }: Props) {
  const [siteFilter, setSiteFilter] = useState(ALL_SITES);
  const sites = useQuery(api.sites.list, { aktifOnly: true });
  const rutes = useQuery(
    api.patroli.listRute,
    siteFilter === ALL_SITES ? {} : { siteId: siteFilter as Id<"sites"> },
  );
  const deleteRute = useMutation(api.patroli.deleteRute);

  const [formOpen, setFormOpen] = useState(false);
  const [editRute, setEditRute] = useState<RuteEditData | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"rutePatroli"> | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRute({ ruteId: deleteId });
      toast.success("Rute dihapus");
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghapus",
      );
    } finally {
      setDeleteId(null);
    }
  };

  const openAdd = () => { setEditRute(null); setFormOpen(true); };
  const openEdit = (r: RuteRow) => {
    setEditRute({
      _id: r._id,
      nama: r.nama,
      siteId: r.siteId,
      estimasiMenit: r.estimasiMenit,
      keterangan: r.keterangan,
      aktif: r.aktif,
    });
    setFormOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SITES}>Semua Site</SelectItem>
            {sites?.map((s) => (
              <SelectItem key={s._id} value={s._id}>{s.kode} — {s.nama}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openAdd} className="cursor-pointer">
          <Plus className="size-4" /> Tambah Rute
        </Button>
      </div>

      {rutes === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : rutes.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Route /></EmptyMedia>
            <EmptyTitle>Belum ada rute patroli</EmptyTitle>
            <EmptyDescription>Buat rute patroli beserta checkpoint-nya untuk mulai menjadwalkan patroli.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={openAdd} className="cursor-pointer">Tambah Rute</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(rutes as RuteRow[]).map((rute) => (
            <Card key={rute._id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{rute.nama}</CardTitle>
                  <Badge variant={rute.aktif ? "default" : "secondary"} className="shrink-0 text-[10px]">
                    {rute.aktif ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
                {rute.site ? (
                  <Badge variant="secondary" className="mt-1 w-fit">{rute.site.kode}</Badge>
                ) : (
                  <span className="mt-1 text-xs text-muted-foreground">Tanpa site</span>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Flag className="size-4" /> {rute.jumlahCheckpoint} checkpoint
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" /> {rute.estimasiMenit} menit
                  </span>
                </div>
                {rute.keterangan && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{rute.keterangan}</p>
                )}
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Button
                    variant="secondary" size="sm"
                    className="flex-1 cursor-pointer gap-1"
                    onClick={onLihatCheckpoint}
                  >
                    <MapPin className="size-4" /> Lihat Checkpoint
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 cursor-pointer" onClick={() => openEdit(rute)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="size-8 cursor-pointer text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(rute._id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RuteFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditRute(null); }}
        editRute={editRute}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Rute?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua checkpoint pada rute ini juga akan dihapus. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
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
