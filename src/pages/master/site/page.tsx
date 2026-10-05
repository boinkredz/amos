import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Authenticated } from "convex/react";
import {
  Building2, MapPin, Pencil, Plus, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import SiteFormDialog from "./_components/site-form-dialog.tsx";
import SiteOfficersDialog from "./_components/site-officers-dialog.tsx";

type SiteRow = {
  _id: Id<"sites">;
  nama: string;
  kode: string;
  alamat: string;
  kota?: string;
  koordinat?: { lat: number; lng: number };
  keterangan?: string;
  aktif: boolean;
  jumlahPetugas: number;
  _creationTime: number;
};

type OfficerTarget = { id: Id<"sites">; nama: string };

function SiteList() {
  const sites = useQuery(api.sites.list, {});
  const removeSite = useMutation(api.sites.remove);

  const [formOpen, setFormOpen] = useState(false);
  const [editSite, setEditSite] = useState<SiteRow | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"sites"> | null>(null);
  const [officerTarget, setOfficerTarget] = useState<OfficerTarget | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await removeSite({ siteId: deleteId });
      toast.success("Site dihapus");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Gagal menghapus",
      );
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Operasional"
        description="Kelola lokasi kerja, koordinat GPS, dan penugasan petugas per site."
        action={
          <Button onClick={() => { setEditSite(null); setFormOpen(true); }}>
            <Plus className="size-4" /> Tambah Site
          </Button>
        }
      />

      {sites === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Building2 /></EmptyMedia>
            <EmptyTitle>Belum ada site</EmptyTitle>
            <EmptyDescription>Tambah lokasi kerja pertama untuk mulai mengatur petugas</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => { setEditSite(null); setFormOpen(true); }}>
              Tambah Site
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(sites as SiteRow[]).map((site) => (
            <Card key={site._id} className={site.aktif ? "" : "opacity-60"}>
              <CardContent className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <Building2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm truncate">{site.nama}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{site.kode}</Badge>
                      </div>
                      {site.kota && (
                        <div className="text-xs text-muted-foreground">{site.kota}</div>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={site.aktif
                      ? "bg-green-600 text-white shrink-0"
                      : "shrink-0"}
                    variant={site.aktif ? "default" : "secondary"}
                  >
                    {site.aktif ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>

                {/* Alamat */}
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{site.alamat}</span>
                </div>

                {/* Koordinat */}
                {site.koordinat && (
                  <div className="rounded-md bg-muted px-2.5 py-1.5 text-xs font-mono text-muted-foreground">
                    {site.koordinat.lat.toFixed(6)}, {site.koordinat.lng.toFixed(6)}
                  </div>
                )}

                {/* Keterangan */}
                {site.keterangan && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{site.keterangan}</p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t">
                  <Button
                    variant="ghost" size="sm" className="h-7 text-xs gap-1.5"
                    onClick={() => setOfficerTarget({ id: site._id, nama: site.nama })}
                  >
                    <Users className="size-3" />
                    {site.jumlahPetugas} Petugas
                  </Button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="icon" className="size-7"
                      onClick={() => { setEditSite(site); setFormOpen(true); }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(site._id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SiteFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditSite(null); }}
        editSite={editSite}
      />

      {officerTarget && (
        <SiteOfficersDialog
          open={!!officerTarget}
          onClose={() => setOfficerTarget(null)}
          siteId={officerTarget.id}
          siteName={officerTarget.nama}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Site?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua penugasan petugas di site ini juga akan dihapus. Tindakan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SitePage() {
  return (
    <Authenticated>
      <SiteList />
    </Authenticated>
  );
}
