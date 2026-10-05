import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { AlertTriangle as AlertIcon } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useRole } from "@/hooks/use-role.ts";

type TindakLanjutStatus =
  | "open"
  | "sedang_diperbaiki"
  | "perlu_diganti"
  | "sudah_ditemukan"
  | "lapor_kehilangan"
  | "selesai";

const STATUS_LABELS: Record<TindakLanjutStatus, string> = {
  open: "Perlu ditangani",
  sedang_diperbaiki: "Sedang diperbaiki",
  perlu_diganti: "Perlu diganti",
  sudah_ditemukan: "Sudah ditemukan",
  lapor_kehilangan: "Lapor kehilangan",
  selesai: "Selesai",
};

const STATUS_VARIANTS: Record<TindakLanjutStatus, string> = {
  open: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  sedang_diperbaiki: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  perlu_diganti: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  sudah_ditemukan: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  lapor_kehilangan: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  selesai: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const RUSAK_STATUSES: TindakLanjutStatus[] = ["open", "sedang_diperbaiki", "perlu_diganti", "selesai"];
const HILANG_STATUSES: TindakLanjutStatus[] = ["open", "sudah_ditemukan", "lapor_kehilangan", "selesai"];

export default function RiwayatTracking({
  siteId,
}: {
  siteId: Id<"sites"> | null;
}) {
  const { canManageOps } = useRole();
  const sites = useQuery(api.sites.list, {});
  const [selectedSiteId, setSelectedSiteId] = useState<string>(siteId ?? "");
  const tindakLanjut = useQuery(
    api.perlengkapan.listTindakLanjutBySite,
    selectedSiteId ? { siteId: selectedSiteId as Id<"sites"> } : "skip",
  );
  const updateMutation = useMutation(api.perlengkapan.updateTindakLanjut);

  const [editItem, setEditItem] = useState<{
    id: Id<"tindakLanjut">;
    jenis: "rusak" | "hilang";
    currentStatus: TindakLanjutStatus;
  } | null>(null);
  const [newStatus, setNewStatus] = useState<TindakLanjutStatus>("open");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEdit(item: NonNullable<typeof tindakLanjut>[number]) {
    setEditItem({
      id: item._id,
      jenis: item.jenis,
      currentStatus: item.status as TindakLanjutStatus,
    });
    setNewStatus(item.status as TindakLanjutStatus);
    setCatatan(item.catatan ?? "");
  }

  async function handleUpdateStatus() {
    if (!editItem) return;
    setLoading(true);
    try {
      await updateMutation({
        id: editItem.id,
        status: newStatus,
        catatan: catatan || undefined,
      });
      toast.success("Status berhasil diperbarui");
      setEditItem(null);
    } catch {
      toast.error("Gagal memperbarui status");
    } finally {
      setLoading(false);
    }
  }

  const openItems = tindakLanjut?.filter((t) => t.status !== "selesai") ?? [];
  const closedItems = tindakLanjut?.filter((t) => t.status === "selesai") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih site..." />
            </SelectTrigger>
            <SelectContent>
              {sites?.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {s.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedSiteId && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><AlertIcon /></EmptyMedia>
            <EmptyTitle>Pilih site</EmptyTitle>
            <EmptyDescription>Pilih site untuk melihat riwayat tindak lanjut</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {selectedSiteId && tindakLanjut === undefined && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {selectedSiteId && tindakLanjut?.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><CheckCircle2 /></EmptyMedia>
            <EmptyTitle>Tidak ada masalah</EmptyTitle>
            <EmptyDescription>Semua perlengkapan dalam kondisi baik</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {openItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Perlu Perhatian ({openItems.length})
          </h3>
          {openItems.map((item) => (
            <TindakLanjutCard
              key={item._id}
              item={item}
              expanded={expanded.has(item._id)}
              onToggle={() => toggleExpand(item._id)}
              canManageOps={canManageOps}
              onEdit={() => openEdit(item)}
            />
          ))}
        </div>
      )}

      {closedItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Selesai ({closedItems.length})
          </h3>
          {closedItems.map((item) => (
            <TindakLanjutCard
              key={item._id}
              item={item}
              expanded={expanded.has(item._id)}
              onToggle={() => toggleExpand(item._id)}
              canManageOps={canManageOps}
              onEdit={() => openEdit(item)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Tindak Lanjut</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status baru</Label>
              <Select
                value={newStatus}
                onValueChange={(v) => setNewStatus(v as TindakLanjutStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(editItem?.jenis === "rusak" ? RUSAK_STATUSES : HILANG_STATUSES).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                rows={3}
                placeholder="Tambahkan catatan tindak lanjut..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditItem(null)}>Batal</Button>
            <Button onClick={handleUpdateStatus} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TindakLanjutCard({
  item,
  expanded,
  onToggle,
  canManageOps,
  onEdit,
}: {
  item: {
    _id: string;
    _creationTime: number;
    alatNama?: string;
    updaterNama?: string;
    jenis: "rusak" | "hilang";
    status: string;
    catatan?: string;
  };
  expanded: boolean;
  onToggle: () => void;
  canManageOps: boolean;
  onEdit: () => void;
}) {
  const status = item.status as TindakLanjutStatus;
  const borderColor = status === "selesai" ? "border-l-green-500"
    : item.jenis === "hilang" ? "border-l-destructive"
    : "border-l-amber-400";
  return (
    <div className={`rounded-xl border-l-4 border border-border bg-card shadow-sm ${borderColor}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {item.jenis === "rusak" ? (
            <AlertTriangle className="size-4 text-yellow-500 shrink-0" />
          ) : (
            <XCircle className="size-4 text-red-500 shrink-0" />
          )}
          <div>
            <div className="text-[15px] font-semibold text-foreground leading-tight">{item.alatNama ?? "Alat tidak dikenal"}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              {item.jenis === "rusak" ? "Rusak" : "Hilang"} •{" "}
              {format(item._creationTime, "d MMM yyyy", { locale: idLocale })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_VARIANTS[status]}`}>
            {STATUS_LABELS[status]}
          </span>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t px-4 py-3 space-y-2">
          {item.catatan && (
            <p className="text-sm text-muted-foreground">{item.catatan}</p>
          )}
          <div className="text-xs text-muted-foreground">
            Diperbarui oleh: {item.updaterNama ?? "—"}
          </div>
          {canManageOps && status !== "selesai" && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Update Status
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
