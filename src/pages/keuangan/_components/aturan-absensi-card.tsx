import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Clock, Pencil } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog.tsx";
import { formatRupiah } from "@/lib/utils.ts";

type Aturan = { toleransiTerlambatMenit: number; dendaTerlambat: number; dendaPulangCepat: number };

export default function AturanAbsensiCard({ canEdit }: { canEdit: boolean }) {
  const aturan = useQuery(api.aturanAbsensi.get, {});
  const [editing, setEditing] = useState(false);

  if (aturan === undefined) return <Skeleton className="h-28 w-full" />;

  const items = [
    { label: "Toleransi terlambat", value: `${aturan.toleransiTerlambatMenit} menit` },
    { label: "Denda terlambat", value: `${formatRupiah(aturan.dendaTerlambat)} / kejadian` },
    { label: "Denda pulang cepat", value: `${formatRupiah(aturan.dendaPulangCepat)} / kejadian` },
  ];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">Aturan Absensi & Denda</h3>
        </div>
        {canEdit && (
          <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5 mr-1" /> Ubah
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {items.map((i) => (
          <div key={i.label} className="rounded-md bg-muted/50 px-3 py-2">
            <div className="text-xs text-muted-foreground">{i.label}</div>
            <div className="text-sm font-semibold">{i.value}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Terlambat jika check-in lebih dari toleransi setelah jam mulai shift. Pulang cepat jika check-out sebelum jam selesai shift.
      </p>
      {editing && <AturanDialog initial={aturan} onClose={() => setEditing(false)} />}
    </div>
  );
}

function AturanDialog({ initial, onClose }: { initial: Aturan; onClose: () => void }) {
  const update = useMutation(api.aturanAbsensi.update);
  const [toleransi, setToleransi] = useState(String(initial.toleransiTerlambatMenit));
  const [dendaTerlambat, setDendaTerlambat] = useState(String(initial.dendaTerlambat));
  const [dendaPulangCepat, setDendaPulangCepat] = useState(String(initial.dendaPulangCepat));
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      await update({
        toleransiTerlambatMenit: Number(toleransi) || 0,
        dendaTerlambat: Number(dendaTerlambat) || 0,
        dendaPulangCepat: Number(dendaPulangCepat) || 0,
      });
      toast.success("Aturan absensi disimpan");
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aturan Absensi & Denda</DialogTitle>
          <DialogDescription>Berlaku untuk semua personel. Denda dihitung per kejadian di Rekap Gaji.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Toleransi terlambat (menit)</Label>
            <Input type="number" min="0" placeholder="5" value={toleransi} onChange={(e) => setToleransi(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Denda terlambat (Rp)</Label>
              <Input type="number" min="0" placeholder="50000" value={dendaTerlambat} onChange={(e) => setDendaTerlambat(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Denda pulang cepat (Rp)</Label>
              <Input type="number" min="0" placeholder="50000" value={dendaPulangCepat} onChange={(e) => setDendaPulangCepat(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="cursor-pointer" onClick={onClose}>Batal</Button>
          <Button className="cursor-pointer" onClick={handleSave} disabled={loading}>{loading ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
