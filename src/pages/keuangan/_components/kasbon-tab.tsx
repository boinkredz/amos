import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import { Plus, CreditCard, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import { format } from "date-fns";
import { useRole } from "@/hooks/use-role.ts";
import { formatRupiah } from "@/lib/utils.ts";

export default function KasbonTab() {
  const { canManageOps } = useRole();
  const isFinance = canManageOps;

  const [statusFilter, setStatusFilter] = useState<"aktif" | "lunas" | "">("");
  const managerKasbon = useQuery(
    api.keuangan.listKasbon,
    isFinance ? { status: statusFilter || undefined } : "skip",
  );
  const myKasbon = useQuery(api.keuangan.getMyKasbon, !isFinance ? {} : "skip");
  const rows = isFinance ? managerKasbon : myKasbon;

  const [showForm, setShowForm] = useState(false);
  const [payTarget, setPayTarget] = useState<{ id: Id<"kasbon">; sisa: number; cicilan: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const payMutation = useMutation(api.keuangan.bayarKasbon);
  const [payLoading, setPayLoading] = useState(false);

  async function handleBayar() {
    if (!payTarget || !payAmount) return;
    setPayLoading(true);
    try {
      await payMutation({ kasbonId: payTarget.id, jumlahBayar: Number(payAmount) });
      toast.success("Pembayaran dicatat");
      setPayTarget(null);
    } catch { toast.error("Gagal menyimpan"); } finally { setPayLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {isFinance && (
          <>
            {(["", "aktif", "lunas"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {s === "" ? "Semua" : s === "aktif" ? "Aktif" : "Lunas"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground border border-primary hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-3" /> Tambah Kasbon
            </button>
          </>
        )}
      </div>

      {rows === undefined ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><CreditCard /></EmptyMedia>
            <EmptyTitle>Tidak ada kasbon</EmptyTitle>
            <EmptyDescription>{statusFilter ? `Tidak ada kasbon ${statusFilter}` : "Belum ada kasbon tercatat"}</EmptyDescription>
          </EmptyHeader>
          {isFinance && <EmptyContent><Button size="sm" onClick={() => setShowForm(true)}>Tambah Kasbon</Button></EmptyContent>}
        </Empty>
      ) : (
          <div className="space-y-3">
          {rows.map((k) => {
            const persen = k.jumlah > 0 ? Math.round(((k.jumlah - k.sisa) / k.jumlah) * 100) : 100;
            const borderColor = k.status === "lunas" ? "border-l-green-500" : "border-l-amber-400";
            return (
              <div key={k._id} className={cn("rounded-xl border-l-4 border border-border bg-card p-4 space-y-3 shadow-sm", borderColor)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {isFinance && (
                      <div className="text-[13px] font-semibold text-foreground leading-tight">{(k as typeof k & { officerNama?: string }).officerNama}</div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">Pinjam: {k.tanggalPinjam}</div>
                    {k.keterangan && <div className="text-[11px] text-muted-foreground font-normal">{k.keterangan}</div>}
                  </div>
                  <Badge variant={k.status === "aktif" ? "secondary" : "default"} className="shrink-0 text-[11px] font-semibold">
                    {k.status === "lunas" ? <CheckCircle2 className="size-3 mr-1" /> : null}
                    {k.status === "aktif" ? "Aktif" : "Lunas"}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground font-medium">Pinjam</div>
                    <div className="text-[12px] font-bold text-foreground">{formatRupiah(k.jumlah)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-medium">Sisa</div>
                    <div className="text-[12px] font-bold text-red-500">{formatRupiah(k.sisa)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-medium">Cicilan/bln</div>
                    <div className="text-[12px] font-bold text-foreground">{formatRupiah(k.cicilanPerBulan)}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Terlunasi</span>
                    <span>{persen}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${persen}%` }} />
                  </div>
                </div>

                {isFinance && k.status === "aktif" && (
                  <>
                    <div className="h-px bg-border" />
                    <Button size="sm" variant="secondary" className="w-full text-xs font-semibold" onClick={() => {
                      setPayTarget({ id: k._id, sisa: k.sisa, cicilan: k.cicilanPerBulan });
                      setPayAmount(String(k.cicilanPerBulan));
                    }}>
                      Catat Pembayaran
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isFinance && <AddKasbonDialog open={showForm} onClose={() => setShowForm(false)} />}

      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Catat Pembayaran Kasbon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Sisa utang: <strong>{formatRupiah(payTarget?.sisa ?? 0)}</strong></div>
            <div className="space-y-1.5">
              <Label>Jumlah Bayar (Rp)</Label>
              <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>Batal</Button>
            <Button onClick={handleBayar} disabled={payLoading}>{payLoading ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddKasbonDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createMutation = useMutation(api.keuangan.createKasbon);
  const officers = useQuery(api.officers.list, { status: "aktif" });
  const today = format(new Date(), "yyyy-MM-dd");
  const [officerId, setOfficerId] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [cicilan, setCicilan] = useState("");
  const [tanggal, setTanggal] = useState(today);
  const [keterangan, setKeterangan] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!officerId || !jumlah || !cicilan) { toast.error("Lengkapi data"); return; }
    setLoading(true);
    try {
      await createMutation({
        officerId: officerId as Id<"officers">,
        jumlah: Number(jumlah),
        cicilanPerBulan: Number(cicilan),
        tanggalPinjam: tanggal,
        keterangan: keterangan || undefined,
      });
      toast.success("Kasbon ditambahkan");
      onClose();
      setOfficerId(""); setJumlah(""); setCicilan(""); setKeterangan("");
    } catch { toast.error("Gagal menyimpan"); } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Tambah Kasbon</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Petugas</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger><SelectValue placeholder="Pilih petugas..." /></SelectTrigger>
              <SelectContent>{officers?.map((o) => <SelectItem key={o._id} value={o._id}>{o.nama}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jumlah Pinjam (Rp)</Label>
              <Input type="number" placeholder="0" value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cicilan/Bulan (Rp)</Label>
              <Input type="number" placeholder="0" value={cicilan} onChange={(e) => setCicilan(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tanggal Pinjam</Label>
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Keterangan (opsional)</Label>
            <Textarea rows={2} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
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
