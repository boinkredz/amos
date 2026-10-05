import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { useRole } from "@/hooks/use-role.ts";

// ─── Jabatan Tab ─────────────────────────────────────────────────────────────

function JabatanTab() {
  const { isAdmin } = useRole();
  const jabatanList = useQuery(api.masterData.listJabatan, {});
  const createJabatan = useMutation(api.masterData.createJabatan);
  const updateJabatan = useMutation(api.masterData.updateJabatan);
  const deleteJabatan = useMutation(api.masterData.deleteJabatan);

  const [newNama, setNewNama] = useState("");
  const [editId, setEditId] = useState<Id<"masterJabatan"> | null>(null);
  const [editNama, setEditNama] = useState("");

  const handleCreate = async () => {
    if (!newNama.trim()) return;
    try {
      await createJabatan({ nama: newNama.trim() });
      toast.success("Jabatan berhasil ditambahkan");
      setNewNama("");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menambahkan");
    }
  };

  const handleUpdate = async (id: Id<"masterJabatan">) => {
    if (!editNama.trim()) return;
    try {
      await updateJabatan({ id, nama: editNama.trim() });
      toast.success("Jabatan berhasil diubah");
      setEditId(null);
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal mengubah");
    }
  };

  const handleDelete = async (id: Id<"masterJabatan">) => {
    if (!confirm("Hapus jabatan ini?")) return;
    try {
      await deleteJabatan({ id });
      toast.success("Jabatan dihapus");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghapus");
    }
  };

  const handleToggleAktif = async (id: Id<"masterJabatan">, aktif: boolean) => {
    try {
      await updateJabatan({ id, aktif: !aktif });
      toast.success(aktif ? "Jabatan dinonaktifkan" : "Jabatan diaktifkan");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal mengubah status");
    }
  };

  if (!jabatanList) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex gap-2">
          <Input
            placeholder="Nama jabatan baru..."
            value={newNama}
            onChange={(e) => setNewNama(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="max-w-sm"
          />
          <Button className="cursor-pointer" onClick={handleCreate} disabled={!newNama.trim()}>
            <Plus className="mr-1.5 h-4 w-4" /> Tambah
          </Button>
        </div>
      )}

      {jabatanList.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Plus /></EmptyMedia>
            <EmptyTitle>Belum ada jabatan</EmptyTitle>
            <EmptyDescription>Tambahkan jabatan pertama.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" className="cursor-pointer" onClick={() => document.querySelector<HTMLInputElement>("input[placeholder*='jabatan']")?.focus()}>
              Tambah Jabatan
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {jabatanList.map((item) => (
            <Card key={item._id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                {editId === item._id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editNama}
                      onChange={(e) => setEditNama(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(item._id)}
                      className="max-w-xs"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="cursor-pointer" onClick={() => handleUpdate(item._id)}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="cursor-pointer" onClick={() => setEditId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium">{item.nama}</span>
                    {!item.aktif && <Badge variant="secondary">Nonaktif</Badge>}
                  </div>
                )}
                {isAdmin && editId !== item._id && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-xs"
                      onClick={() => handleToggleAktif(item._id, item.aktif)}
                    >
                      {item.aktif ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button size="icon" variant="ghost" className="cursor-pointer" onClick={() => { setEditId(item._id); setEditNama(item.nama); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="cursor-pointer" onClick={() => handleDelete(item._id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Lokasi Gedung Tab ───────────────────────────────────────────────────────

function LokasiGedungTab() {
  const { isAdmin } = useRole();
  const lokasiList = useQuery(api.masterData.listLokasiGedung, {});
  const createLokasi = useMutation(api.masterData.createLokasiGedung);
  const updateLokasi = useMutation(api.masterData.updateLokasiGedung);
  const deleteLokasi = useMutation(api.masterData.deleteLokasiGedung);

  const [newNama, setNewNama] = useState("");
  const [editId, setEditId] = useState<Id<"masterLokasiGedung"> | null>(null);
  const [editNama, setEditNama] = useState("");

  const handleCreate = async () => {
    if (!newNama.trim()) return;
    try {
      await createLokasi({ nama: newNama.trim() });
      toast.success("Lokasi gedung berhasil ditambahkan");
      setNewNama("");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menambahkan");
    }
  };

  const handleUpdate = async (id: Id<"masterLokasiGedung">) => {
    if (!editNama.trim()) return;
    try {
      await updateLokasi({ id, nama: editNama.trim() });
      toast.success("Lokasi gedung berhasil diubah");
      setEditId(null);
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal mengubah");
    }
  };

  const handleDelete = async (id: Id<"masterLokasiGedung">) => {
    if (!confirm("Hapus lokasi gedung ini?")) return;
    try {
      await deleteLokasi({ id });
      toast.success("Lokasi gedung dihapus");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghapus");
    }
  };

  const handleToggleAktif = async (id: Id<"masterLokasiGedung">, aktif: boolean) => {
    try {
      await updateLokasi({ id, aktif: !aktif });
      toast.success(aktif ? "Lokasi dinonaktifkan" : "Lokasi diaktifkan");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal mengubah status");
    }
  };

  if (!lokasiList) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex gap-2">
          <Input
            placeholder="Nama lokasi gedung baru..."
            value={newNama}
            onChange={(e) => setNewNama(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="max-w-sm"
          />
          <Button className="cursor-pointer" onClick={handleCreate} disabled={!newNama.trim()}>
            <Plus className="mr-1.5 h-4 w-4" /> Tambah
          </Button>
        </div>
      )}

      {lokasiList.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Plus /></EmptyMedia>
            <EmptyTitle>Belum ada lokasi gedung</EmptyTitle>
            <EmptyDescription>Tambahkan lokasi gedung pertama.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" className="cursor-pointer" onClick={() => document.querySelector<HTMLInputElement>("input[placeholder*='lokasi']")?.focus()}>
              Tambah Lokasi
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {lokasiList.map((item) => (
            <Card key={item._id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                {editId === item._id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editNama}
                      onChange={(e) => setEditNama(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(item._id)}
                      className="max-w-xs"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="cursor-pointer" onClick={() => handleUpdate(item._id)}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="cursor-pointer" onClick={() => setEditId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium">{item.nama}</span>
                    {!item.aktif && <Badge variant="secondary">Nonaktif</Badge>}
                  </div>
                )}
                {isAdmin && editId !== item._id && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-xs"
                      onClick={() => handleToggleAktif(item._id, item.aktif)}
                    >
                      {item.aktif ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button size="icon" variant="ghost" className="cursor-pointer" onClick={() => { setEditId(item._id); setEditNama(item.nama); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="cursor-pointer" onClick={() => handleDelete(item._id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MasterJabatanPage() {
  return (
    <div>
      <PageHeader
        title="Divisi"
        description="Kelola daftar jabatan dan penempatan yang tersedia di form petugas dan laporan."
      />
      <Tabs defaultValue="jabatan" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jabatan">Jabatan</TabsTrigger>
          <TabsTrigger value="lokasi">Penempatan</TabsTrigger>
        </TabsList>
        <TabsContent value="jabatan">
          <JabatanTab />
        </TabsContent>
        <TabsContent value="lokasi">
          <LokasiGedungTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
