import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useRole } from "@/hooks/use-role.ts";
import { formatRupiah } from "@/lib/utils.ts";

type FilterOfficer = string; // Id or ""

export default function BukuBesarTab({ periode }: { periode: string }) {
  const { canManageOps } = useRole();
  const isFinance = canManageOps;

  const officers = useQuery(api.officers.list, { status: "aktif" });
  const [filterOfficer, setFilterOfficer] = useState<FilterOfficer>("");
  const transaksi = useQuery(
    api.keuangan.listTransaksi,
    isFinance ? { officerId: filterOfficer ? (filterOfficer as Id<"officers">) : undefined, periode } : "skip",
  );
  const myTransaksi = useQuery(
    api.keuangan.getMyTransaksi,
    !isFinance ? { periode } : "skip",
  );
  const rows = isFinance ? transaksi : myTransaksi;

  const addMutation = useMutation(api.keuangan.addTransaksiManual);
  const deleteMutation = useMutation(api.keuangan.deleteTransaksi);

  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Id<"transaksiKeuangan"> | null>(null);

  const totalPemasukan = rows?.filter((r) => r.tipe === "pemasukan").reduce((s, r) => s + r.jumlah, 0) ?? 0;
  const totalPengeluaran = rows?.filter((r) => r.tipe === "pengeluaran").reduce((s, r) => s + r.jumlah, 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="size-4 text-green-500" />
            <span className="text-[11px] text-muted-foreground font-medium">Total Pemasukan</span>
          </div>
          <div className="text-[15px] font-bold text-green-600">{formatRupiah(totalPemasukan)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="size-4 text-red-500" />
            <span className="text-[11px] text-muted-foreground font-medium">Total Pengeluaran</span>
          </div>
          <div className="text-[15px] font-bold text-red-600">{formatRupiah(totalPengeluaran)}</div>
        </div>
      </div>

      {/* Filters + Action */}
      {isFinance && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterOfficer} onValueChange={setFilterOfficer}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Semua petugas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Semua petugas</SelectItem>
              {officers?.map((o) => (
                <SelectItem key={o._id} value={o._id}>{o.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="size-4 mr-1" /> Tambah Transaksi
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {rows === undefined ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><TrendingUp /></EmptyMedia>
            <EmptyTitle>Belum ada transaksi</EmptyTitle>
            <EmptyDescription>Transaksi periode ini akan muncul di sini</EmptyDescription>
          </EmptyHeader>
          {isFinance && <EmptyContent><Button size="sm" onClick={() => setShowForm(true)}>Tambah</Button></EmptyContent>}
        </Empty>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-3 md:hidden">
            {rows.map((r) => {
              const isPemasukan = r.tipe === "pemasukan";
              return (
                <div
                  key={r._id}
                  className={`rounded-xl border-l-4 border border-border bg-card p-4 shadow-sm ${isPemasukan ? "border-l-green-500" : "border-l-destructive"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      {isFinance && (
                        <div className="text-[13px] font-semibold text-foreground">{(r as typeof r & { officerNama?: string }).officerNama ?? ""}</div>
                      )}
                      <div className="text-[11px] text-muted-foreground capitalize font-normal">
                        {r.kategori.replace(/_/g, " ")}{r.keterangan ? ` — ${r.keterangan}` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-medium">{r.tanggal}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`font-bold text-[13px] ${isPemasukan ? "text-green-600" : "text-red-600"}`}>
                        {isPemasukan ? "+" : "−"}{formatRupiah(r.jumlah)}
                      </span>
                      {isFinance && r.kategori === "manual" && (
                        <Button size="icon" variant="ghost" className="size-8 ml-1" onClick={() => setDeleteTarget(r._id)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tanggal</th>
                  {isFinance && <th className="px-3 py-2 text-left font-medium text-muted-foreground">Petugas</th>}
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kategori</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Debit</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Kredit</th>
                  {isFinance && <th className="px-3 py-2 w-8"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r._id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground text-xs">{r.tanggal}</td>
                    {isFinance && <td className="px-3 py-2">{(r as typeof r & { officerNama?: string }).officerNama ?? ""}</td>}
                    <td className="px-3 py-2 capitalize">{r.kategori.replace(/_/g, " ")}{r.keterangan ? ` — ${r.keterangan}` : ""}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-600">
                      {r.tipe === "pemasukan" ? formatRupiah(r.jumlah) : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-red-600">
                      {r.tipe === "pengeluaran" ? formatRupiah(r.jumlah) : ""}
                    </td>
                    {isFinance && (
                      <td className="px-3 py-2">
                        {r.kategori === "manual" && (
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => setDeleteTarget(r._id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isFinance && (
        <AddTransaksiDialog
          open={showForm}
          onClose={() => setShowForm(false)}
          periode={periode}
          officers={officers ?? []}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus transaksi?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!deleteTarget) return;
              try {
                await deleteMutation({ transaksiId: deleteTarget });
                toast.success("Transaksi dihapus");
              } catch { toast.error("Gagal menghapus"); }
              setDeleteTarget(null);
            }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddTransaksiDialog({ open, onClose, periode, officers }: {
  open: boolean; onClose: () => void; periode: string;
  officers: Array<{ _id: Id<"officers">; nama: string }>;
}) {
  const addMutation = useMutation(api.keuangan.addTransaksiManual);
  const today = format(new Date(), "yyyy-MM-dd");
  const [officerId, setOfficerId] = useState("");
  const [tanggal, setTanggal] = useState(today);
  const [tipe, setTipe] = useState<"pemasukan" | "pengeluaran">("pemasukan");
  const [kategori, setKategori] = useState("manual");
  const [jumlah, setJumlah] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!officerId || !jumlah) { toast.error("Lengkapi data"); return; }
    setLoading(true);
    try {
      await addMutation({
        officerId: officerId as Id<"officers">,
        tanggal,
        tipe,
        kategori,
        jumlah: Number(jumlah),
        keterangan: keterangan || undefined,
        periode,
      });
      toast.success("Transaksi ditambahkan");
      onClose();
      setOfficerId(""); setJumlah(""); setKeterangan("");
    } catch { toast.error("Gagal menyimpan"); } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Tambah Transaksi Manual</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Petugas</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger><SelectValue placeholder="Pilih petugas..." /></SelectTrigger>
              <SelectContent>{officers.map((o) => <SelectItem key={o._id} value={o._id}>{o.nama}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tanggal</Label>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipe</Label>
              <Select value={tipe} onValueChange={(v) => setTipe(v as "pemasukan" | "pengeluaran")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pemasukan">Pemasukan</SelectItem>
                  <SelectItem value="pengeluaran">Pengeluaran</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Jumlah (Rp)</Label>
            <Input type="number" placeholder="0" value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Keterangan</Label>
            <Textarea rows={2} placeholder="Keterangan transaksi..." value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
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
