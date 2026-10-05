import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Authenticated } from "convex/react";
import { MapPin, Plus, Pencil, Trash2, CircleDot, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import PageHeader from "@/components/page-header.tsx";
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
import GeoFenceFormDialog from "./_components/geofence-form-dialog.tsx";
import GeoFenceMap from "./_components/geofence-map.tsx";

type GeoFenceDoc = {
  _id: Id<"geoFence">;
  siteId: Id<"sites">;
  nama: string;
  lat: number;
  lng: number;
  radius: number;
  keterangan?: string;
  aktif: boolean;
  site?: { _id: Id<"sites">; nama: string; kode: string } | null;
};

function GeoFenceCard({ zone, onEdit, onDelete }: {
  zone: GeoFenceDoc;
  onEdit: (z: GeoFenceDoc) => void;
  onDelete: (id: Id<"geoFence">) => void;
}) {
  return (
    <Card className={!zone.aktif ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDot className="size-4 text-accent" />
              {zone.nama}
            </CardTitle>
            {zone.site && (
              <Badge variant="secondary" className="mt-1 text-xs">{zone.site.kode} — {zone.site.nama}</Badge>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {!zone.aktif && <Badge variant="outline" className="text-xs">Nonaktif</Badge>}
            <Button variant="ghost" size="icon" onClick={() => onEdit(zone)}><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(zone._id)}><Trash2 className="size-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <GeoFenceMap lat={zone.lat} lng={zone.lng} radius={zone.radius} label={zone.nama} className="h-40 w-full rounded-md" />
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground">Koordinat Pusat</div>
            <div className="font-mono font-medium">{zone.lat.toFixed(5)}, {zone.lng.toFixed(5)}</div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground">Radius</div>
            <div className="font-semibold">{zone.radius} meter</div>
          </div>
        </div>
        {zone.keterangan && (
          <p className="text-sm text-muted-foreground">{zone.keterangan}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function GeoFencePage() {
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editZone, setEditZone] = useState<GeoFenceDoc | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"geoFence"> | null>(null);

  const zones = useQuery(api.geofence.listAll, {});
  const sites = useQuery(api.sites.list, {});
  const removeZone = useMutation(api.geofence.remove);

  const filtered = zones?.filter((z) => siteFilter === "all" || z.siteId === siteFilter);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await removeZone({ zoneId: deleteId });
      toast.success("Zona dihapus");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghapus");
    } finally { setDeleteId(null); }
  };

  return (
    <Authenticated>
      <div>
        <PageHeader
          title="Master Geo Fence"
          description="Kelola zona geofence per site untuk validasi lokasi check-in absensi."
          action={
            <Button onClick={() => { setEditZone(null); setFormOpen(true); }}>
              <Plus className="size-4" /> Tambah Zona
            </Button>
          }
        />

        <div className="mb-4 flex items-center gap-3">
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Site</SelectItem>
              {sites?.map((s) => (
                <SelectItem key={s._id} value={s._id}>{s.nama} [{s.kode}]</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered !== undefined && (
            <span className="text-sm text-muted-foreground">{filtered.length} zona ditemukan</span>
          )}
        </div>

        {zones === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        ) : filtered?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><MapPin /></EmptyMedia>
              <EmptyTitle>Belum ada zona geo fence</EmptyTitle>
              <EmptyDescription>Tambahkan zona geofence untuk memvalidasi lokasi check-in petugas.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={() => { setEditZone(null); setFormOpen(true); }}>Tambah Zona</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered?.map((zone) => (
              <GeoFenceCard
                key={zone._id}
                zone={zone as GeoFenceDoc}
                onEdit={(z) => { setEditZone(z); setFormOpen(true); }}
                onDelete={setDeleteId}
              />
            ))}
          </div>
        )}

        <GeoFenceFormDialog
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditZone(null); }}
          editZone={editZone}
        />

        <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Zona?</AlertDialogTitle>
              <AlertDialogDescription>
                Zona yang dihapus tidak bisa dipulihkan. Petugas yang check-in di site ini tidak lagi divalidasi oleh zona ini.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">Hapus</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Authenticated>
  );
}
