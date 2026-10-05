import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { useQuery as useQuerySites } from "convex/react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { ClipboardCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { useRole } from "@/hooks/use-role.ts";

type Kategori = "komunikasi" | "keamanan" | "APD" | "kendaraan" | "lainnya";

const KATEGORI_LABELS: Record<Kategori, string> = {
  komunikasi: "Komunikasi",
  keamanan: "Keamanan",
  APD: "APD",
  kendaraan: "Kendaraan",
  lainnya: "Lainnya",
};

const KATEGORI_COLORS: Record<Kategori, string> = {
  komunikasi: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  keamanan: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  APD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  kendaraan: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  lainnya: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

type FormData = {
  nama: string;
  kategori: Kategori;
  jumlahStandar: string;
  siteId: string;
  keterangan: string;
};

const DEFAULT_FORM: FormData = {
  nama: "",
  kategori: "lainnya",
  jumlahStandar: "1",
  siteId: "",
  keterangan: "",
};

export default function MasterPerlengkapan() {
  const { canManageOps } = useRole();
  const sites = useQuerySites(api.sites.list, {});
  const alat = useQuery(api.perlengkapan.listMaster, {});
  const createMutation = useMutation(api.perlengkapan.createMaster);
  const updateMutation = useMutation(api.perlengkapan.updateMaster);
  const deleteMutation = useMutation(api.perlengkapan.deleteMaster);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"masterPerlengkapan"> | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);

  function openCreate() {
    setEditId(null);
    setForm(DEFAULT_FORM);
    setOpen(true);
  }

  function openEdit(item: NonNullable<typeof alat>[number]) {
    setEditId(item._id);
    setForm({
      nama: item.nama,
      kategori: item.kategori as Kategori,
      jumlahStandar: String(item.jumlahStandar),
      siteId: item.siteId,
      keterangan: item.keterangan ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!form.nama || !form.siteId) {
      toast.error("Nama dan site wajib diisi");
      return;
    }
    setLoading(true);
    try {
      if (editId) {
        await updateMutation({
          id: editId,
          nama: form.nama,
          kategori: form.kategori,
          jumlahStandar: Number(form.jumlahStandar),
          keterangan: form.keterangan || undefined,
        });
        toast.success("Alat berhasil diperbarui");
      } else {
        await createMutation({
          nama: form.nama,
          kategori: form.kategori,
          jumlahStandar: Number(form.jumlahStandar),
          siteId: form.siteId as Id<"sites">,
          keterangan: form.keterangan || undefined,
        });
        toast.success("Alat berhasil ditambahkan");
      }
      setOpen(false);
    } catch {
      toast.error("Gagal menyimpan data");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAktif(item: NonNullable<typeof alat>[number]) {
    try {
      await updateMutation({ id: item._id, aktif: !item.aktif });
      toast.success(item.aktif ? "Alat dinonaktifkan" : "Alat diaktifkan");
    } catch {
      toast.error("Gagal memperbarui status");
    }
  }

  async function handleDelete(id: Id<"masterPerlengkapan">) {
    if (!confirm("Hapus alat ini?")) return;
    try {
      await deleteMutation({ id });
      toast.success("Alat dihapus");
    } catch {
      toast.error("Gagal menghapus alat");
    }
  }

  if (alat === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManageOps && (
        <div className="flex justify-end">
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1 size-4" />
            Tambah Alat
          </Button>
        </div>
      )}

      {alat.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardCheck /></EmptyMedia>
            <EmptyTitle>Belum ada alat terdaftar</EmptyTitle>
            <EmptyDescription>Tambahkan peralatan standar untuk setiap site</EmptyDescription>
          </EmptyHeader>
          {canManageOps && (
            <EmptyContent>
              <Button size="sm" onClick={openCreate}>Tambah Alat</Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-2">
          {alat.map((item) => {
            const site = sites?.find((s) => s._id === item.siteId);
            return (
              <div
                key={item._id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{item.nama}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${KATEGORI_COLORS[item.kategori as Kategori]}`}
                      >
                        {KATEGORI_LABELS[item.kategori as Kategori]}
                      </span>
                      {!item.aktif && (
                        <Badge variant="secondary" className="text-xs">Nonaktif</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {site?.nama ?? "—"} • Standar: {item.jumlahStandar} unit
                    </div>
                  </div>
                </div>
                {canManageOps && (
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => handleToggleAktif(item)}
                      title={item.aktif ? "Nonaktifkan" : "Aktifkan"}
                    >
                      {item.aktif ? (
                        <ToggleRight className="size-4 text-accent" />
                      ) : (
                        <ToggleLeft className="size-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => handleDelete(item._id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Alat" : "Tambah Alat"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Alat</Label>
              <Input
                placeholder="contoh: HT Motorola"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  value={form.kategori}
                  onValueChange={(v) => setForm({ ...form, kategori: v as Kategori })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(KATEGORI_LABELS) as Kategori[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {KATEGORI_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jumlah Standar</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.jumlahStandar}
                  onChange={(e) => setForm({ ...form, jumlahStandar: e.target.value })}
                />
              </div>
            </div>
            {!editId && (
              <div className="space-y-2">
                <Label>Site</Label>
                <Select
                  value={form.siteId}
                  onValueChange={(v) => setForm({ ...form, siteId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih site" />
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
            )}
            <div className="space-y-2">
              <Label>Keterangan (opsional)</Label>
              <Textarea
                placeholder="Catatan tambahan..."
                value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
