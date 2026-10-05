import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Plus, UserMinus, Users } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

type Props = {
  open: boolean;
  onClose: () => void;
  siteId: Id<"sites">;
  siteName: string;
};

type UnassignTarget = { id: Id<"siteOfficers">; nama: string };

export default function SiteOfficersDialog({ open, onClose, siteId, siteName }: Props) {
  const assigned = useQuery(api.sites.listOfficers, open ? { siteId } : "skip");
  const allOfficers = useQuery(api.officers.list, open ? { status: "aktif" } : "skip");
  const assign = useMutation(api.sites.assignOfficer);
  const unassign = useMutation(api.sites.unassignOfficer);

  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [unassignTarget, setUnassignTarget] = useState<UnassignTarget | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const assignedIds = new Set(assigned?.map((a) => a.officerId) ?? []);
  const available = allOfficers?.filter((o) => !assignedIds.has(o._id)) ?? [];

  const handleAssign = async () => {
    if (!selectedOfficer) return;
    setIsAssigning(true);
    try {
      await assign({
        siteId,
        officerId: selectedOfficer as Id<"officers">,
        tanggalMulai: format(new Date(), "yyyy-MM-dd"),
      });
      toast.success("Petugas ditugaskan");
      setSelectedOfficer("");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Gagal menugaskan",
      );
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async () => {
    if (!unassignTarget) return;
    try {
      await unassign({
        siteOfficerId: unassignTarget.id,
        tanggalSelesai: format(new Date(), "yyyy-MM-dd"),
      });
      toast.success("Petugas dilepas dari site");
    } catch {
      toast.error("Gagal melepas petugas");
    } finally {
      setUnassignTarget(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Petugas di {siteName}</DialogTitle>
          </DialogHeader>

          {/* Assign new */}
          <div className="flex gap-2">
            <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Pilih petugas untuk ditugaskan..." />
              </SelectTrigger>
              <SelectContent>
                {available.map((o) => (
                  <SelectItem key={o._id} value={o._id}>
                    {o.nama} — {o.jabatan}
                  </SelectItem>
                ))}
                {available.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Semua petugas aktif sudah ditugaskan
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm" disabled={!selectedOfficer || isAssigning}
              onClick={handleAssign}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {/* Assigned list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {assigned === undefined ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))
            ) : assigned.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <Users className="size-8 opacity-40" />
                <p className="text-sm">Belum ada petugas di site ini</p>
              </div>
            ) : (
              assigned.map((row) => (
                <div
                  key={row._id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium">{row.officer?.nama ?? "—"}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>{row.officer?.jabatan}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        sejak {row.tanggalMulai}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive"
                    onClick={() =>
                      setUnassignTarget({
                        id: row._id,
                        nama: row.officer?.nama ?? "petugas ini",
                      })
                    }
                  >
                    <UserMinus className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!unassignTarget}
        onOpenChange={(v) => !v && setUnassignTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lepas Petugas?</AlertDialogTitle>
            <AlertDialogDescription>
              {unassignTarget?.nama} akan dilepas dari site {siteName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnassign}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Lepas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
