import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import { Settings, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { formatRupiah } from "@/lib/utils.ts";
import { ConvexError } from "convex/values";
import AturanAbsensiCard from "./aturan-absensi-card.tsx";

export default function PengaturanGajiTab() {
  const { canManageOps, role } = useRole();
  const officers = useQuery(api.officers.list, { status: "aktif" });
  const komponenList = useQuery(api.keuangan.listKomponen, canManageOps ? {} : "skip");

  const [editTarget, setEditTarget] = useState<{ officerId: Id<"officers">; nama: string } | null>(null);

  if (!canManageOps) {
    return <div className="text-muted-foreground text-sm py-8 text-center">Hanya admin & finance yang dapat mengatur komponen gaji.</div>;
  }

  if (officers === undefined || komponenList === undefined) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  const komponenMap = new Map(komponenList.map((k) => [k.officerId, k]));

  return (
    <div className="space-y-4">
      <AturanAbsensiCard canEdit={role === "admin" || role === "finance" || role === "hr"} />
      <div className="text-sm text-muted-foreground">
        Atur komponen gaji per petugas. Klik ikon edit untuk mengubah.
      </div>

      {officers.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Settings /></EmptyMedia>
            <EmptyTitle>Tidak ada petugas aktif</EmptyTitle>
            <EmptyDescription>Tambahkan petugas terlebih dahulu</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Petugas</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Gaji Pokok</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">Tunjangan</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden md:table-cell">Bonus Backup</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden md:table-cell">BPJS %</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {officers.map((o) => {
                const k = komponenMap.get(o._id);
                return (
                  <tr key={o._id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{o.nama}</td>
                    <td className="px-3 py-2 text-right">{k ? formatRupiah(k.gajiPokok) : <span className="text-muted-foreground text-xs">Belum diset</span>}</td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell">{k ? formatRupiah(k.tunjangan) : "-"}</td>
                    <td className="px-3 py-2 text-right hidden md:table-cell">{k ? formatRupiah(k.bonusBackup) : "-"}</td>
                    <td className="px-3 py-2 text-right hidden md:table-cell">{k ? `${k.bpjsPersen}%` : "-"}</td>
                    <td className="px-3 py-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => setEditTarget({ officerId: o._id, nama: o.nama })}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <KomponenFormDialog
          officerId={editTarget.officerId}
          officerNama={editTarget.nama}
          existing={komponenMap.get(editTarget.officerId)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

function KomponenFormDialog({
  officerId, officerNama, existing, onClose,
}: {
  officerId: Id<"officers">;
  officerNama: string;
  existing?: { gajiPokok: number; tunjangan: number; bonusBackup: number; dendaPerMenit: number; bpjsPersen: number; pajakPersen: number };
  onClose: () => void;
}) {
  const upsertMutation = useMutation(api.keuangan.upsertKomponen);
  const [gajiPokok, setGajiPokok] = useState(String(existing?.gajiPokok ?? ""));
  const [tunjangan, setTunjangan] = useState(String(existing?.tunjangan ?? ""));
  const [bonusBackup, setBonusBackup] = useState(String(existing?.bonusBackup ?? ""));
  const [bpjsPersen, setBpjsPersen] = useState(String(existing?.bpjsPersen ?? "2"));
  const [pajakPersen, setPajakPersen] = useState(String(existing?.pajakPersen ?? "0"));
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!gajiPokok) { toast.error("Gaji pokok wajib diisi"); return; }
    setLoading(true);
    try {
      await upsertMutation({
        officerId,
        gajiPokok: Number(gajiPokok),
        tunjangan: Number(tunjangan) || 0,
        bonusBackup: Number(bonusBackup) || 0,
        // Legacy field: lateness now uses flat per-occurrence penalty from Aturan Absensi
        dendaPerMenit: existing?.dendaPerMenit ?? 0,
        bpjsPersen: Number(bpjsPersen) || 0,
        pajakPersen: Number(pajakPersen) || 0,
      });
      toast.success("Komponen gaji disimpan");
      onClose();
    } catch (err) {
      const msg = err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menyimpan";
      toast.error(msg);
    } finally { setLoading(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Komponen Gaji — {officerNama}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Gaji Pokok (Rp)</Label>
            <Input type="number" placeholder="0" value={gajiPokok} onChange={(e) => setGajiPokok(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tunjangan (Rp)</Label>
            <Input type="number" placeholder="0" value={tunjangan} onChange={(e) => setTunjangan(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Bonus Backup/shift (Rp)</Label>
            <Input type="number" placeholder="0" value={bonusBackup} onChange={(e) => setBonusBackup(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>BPJS (%)</Label>
            <Input type="number" placeholder="2" min="0" max="100" value={bpjsPersen} onChange={(e) => setBpjsPersen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Pajak (%)</Label>
            <Input type="number" placeholder="0" min="0" max="100" value={pajakPersen} onChange={(e) => setPajakPersen(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
