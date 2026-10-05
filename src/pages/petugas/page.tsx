import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  UserCheck,
  UserMinus,
  Plane,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import PageHeader from "@/components/page-header.tsx";
import StatCard from "@/components/stat-card.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import OfficerFormDialog from "./_components/officer-form-dialog.tsx";

const STATUS_STYLE: Record<string, string> = {
  aktif: "bg-chart-3/20 text-foreground",
  cuti: "bg-accent/25 text-foreground",
  nonaktif: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  aktif: "Aktif",
  cuti: "Cuti",
  nonaktif: "Nonaktif",
};

export default function PetugasPage() {
  const { canManageOps: canManage, isAdmin } = useRole();
  const officers = useQuery(api.officers.list, {});
  const stats = useQuery(api.officers.stats, {});
  const remove = useMutation(api.officers.remove);

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Doc<"officers"> | null>(null);
  const [deleting, setDeleting] = useState<Doc<"officers"> | null>(null);

  const filtered = useMemo(() => {
    if (!officers) return [];
    const q = search.trim().toLowerCase();
    if (!q) return officers;
    return officers.filter((o) =>
      [o.nama, o.nik, o.jabatan, o.lokasiTugas]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [officers, search]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove({ officerId: deleting._id });
      toast.success("Petugas dihapus");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Gagal menghapus petugas");
      }
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Data Petugas"
        description="Kelola identitas, jabatan, dan penempatan personel keamanan."
        action={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Tambah Petugas
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 pb-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats === undefined ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] w-full" />
          ))
        ) : (
          <>
            <StatCard label="Total petugas" value={stats.total} icon={Users} />
            <StatCard
              label="Aktif"
              value={stats.aktif}
              icon={UserCheck}
              tone="accent"
            />
            <StatCard label="Cuti" value={stats.cuti} icon={Plane} />
            <StatCard
              label="Nonaktif"
              value={stats.nonaktif}
              icon={UserMinus}
              tone="danger"
            />
          </>
        )}
      </div>

      <div className="relative pb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, NIK, jabatan, atau lokasi"
          className="max-w-md pl-9"
        />
      </div>

      {officers === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>
              {officers.length === 0
                ? "Belum ada data petugas"
                : "Tidak ada hasil"}
            </EmptyTitle>
            <EmptyDescription>
              {officers.length === 0
                ? "Tambahkan personel keamanan pertama untuk mulai mengelola operasional."
                : "Coba ubah kata kunci pencarian Anda."}
            </EmptyDescription>
          </EmptyHeader>
          {canManage && officers.length === 0 && (
            <EmptyContent>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Tambah Petugas
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((officer) => (
            <Card key={officer._id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{officer.nama}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {officer.nik}
                    </div>
                  </div>
                  <Badge className={STATUS_STYLE[officer.status]}>
                    {STATUS_LABEL[officer.status]}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <UserRound className="size-3.5 shrink-0" />
                    <span className="truncate">{officer.jabatan}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{officer.lokasiTugas}</span>
                  </div>
                  {officer.telepon && (
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0" />
                      <span className="truncate">{officer.telepon}</span>
                    </div>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(officer);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Ubah
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(officer)}
                      >
                        <Trash2 className="size-3.5" />
                        Hapus
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <OfficerFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          officer={editing}
        />
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus petugas ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Data {deleting?.nama} akan dihapus permanen dan tidak dapat
              dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
