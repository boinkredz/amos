import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { format } from "date-fns";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Link2, Unlink, User } from "lucide-react";

const LAINNYA = "__lainnya__";

const schema = z.object({
  nama: z.string().min(2, "Nama minimal 2 karakter"),
  nik: z.string().min(3, "NIK minimal 3 karakter"),
  jabatanSelect: z.string().min(1, "Jabatan wajib dipilih"),
  jabatanCustom: z.string().optional(),
  lokasiSelect: z.string().min(1, "Lokasi tugas wajib dipilih"),
  lokasiCustom: z.string().optional(),
  telepon: z.string().optional(),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  status: z.enum(["aktif", "cuti", "nonaktif"]),
  tanggalMasuk: z.string().optional(),
  catatan: z.string().optional(),
  reguId: z.string().optional(),
  seragam: z.string().optional(),
}).refine((d) => d.jabatanSelect !== LAINNYA || (d.jabatanCustom?.trim() ?? "").length >= 2, {
  message: "Jabatan wajib diisi",
  path: ["jabatanCustom"],
}).refine((d) => d.lokasiSelect !== LAINNYA || (d.lokasiCustom?.trim() ?? "").length >= 2, {
  message: "Lokasi tugas wajib diisi",
  path: ["lokasiCustom"],
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officer?: Doc<"officers"> | null;
};

function toDateInput(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ─── Link Akun Section ────────────────────────────────────────────────────────

function LinkAkunSection({ officer }: { officer: Doc<"officers"> }) {
  const users = useQuery(api.users.listUsers, {});
  const linkUser = useMutation(api.officers.linkUser);
  const unlinkUser = useMutation(api.officers.unlinkUser);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");

  const linkedUser = users?.find((u) => u._id === officer.userId);
  const filteredUsers = (users ?? []).filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  async function handleLink() {
    if (!selectedUserId) return;
    setLinking(true);
    try {
      await linkUser({ officerId: officer._id, userId: selectedUserId as Id<"users"> });
      toast.success("Akun berhasil dihubungkan");
      setSelectedUserId("");
      setSearch("");
    } catch (err) {
      const msg = err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menghubungkan akun";
      toast.error(msg);
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    setLinking(true);
    try {
      await unlinkUser({ officerId: officer._id });
      toast.success("Tautan akun dilepas");
    } catch {
      toast.error("Gagal melepas tautan");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="rounded-lg border bg-secondary/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <User className="size-4 text-primary" />
        Hubungkan Akun Login
      </div>

      {linkedUser ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Link2 className="size-3" />
              Terhubung
            </Badge>
            <span className="text-sm">{linkedUser.name ?? "—"}</span>
            <span className="text-xs text-muted-foreground">{linkedUser.email ?? ""}</span>
          </div>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleUnlink} disabled={linking}>
            <Unlink className="size-3 mr-1" /> Lepas
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Pilih akun user yang dimiliki petugas ini agar bisa absen mandiri.</p>
          <Input
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedUserId(""); }}
            className="h-8 text-sm"
          />
          <div className="max-h-36 overflow-y-auto rounded-md border bg-background">
            {users === undefined ? (
              <div className="p-2 text-xs text-muted-foreground text-center">Memuat...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground text-center">Tidak ada akun ditemukan</div>
            ) : (
              filteredUsers.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => setSelectedUserId(u._id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-secondary transition-colors cursor-pointer ${selectedUserId === u._id ? "bg-primary/10 font-medium" : ""}`}
                >
                  <span>{u.name ?? "(tanpa nama)"}</span>
                  <span className="text-xs text-muted-foreground">{u.email ?? ""}</span>
                </button>
              ))
            )}
          </div>
          <Button size="sm" className="w-full" onClick={handleLink} disabled={!selectedUserId || linking}>
            <Link2 className="size-3 mr-2" />
            {linking ? "Menghubungkan..." : "Hubungkan Akun"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export default function OfficerFormDialog({ open, onOpenChange, officer }: Props) {
  const create = useMutation(api.officers.create);
  const update = useMutation(api.officers.update);
  const [submitting, setSubmitting] = useState(false);

  const jabatanList = useQuery(api.masterData.listJabatan, { aktifOnly: true });
  const lokasiList = useQuery(api.masterData.listLokasiGedung, { aktifOnly: true });
  // Active regu list for assignment
  const reguList = useQuery(api.regu.listAktif, {});

  // Determine if existing value is in list or custom
  const jabatanInList = jabatanList?.some((j) => j.nama === officer?.jabatan);
  const lokasiInList = lokasiList?.some((l) => l.nama === officer?.lokasiTugas);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      nama: officer?.nama ?? "",
      nik: officer?.nik ?? "",
      jabatanSelect: officer?.jabatan
        ? (jabatanInList ? officer.jabatan : LAINNYA)
        : "",
      jabatanCustom: officer?.jabatan && !jabatanInList ? officer.jabatan : "",
      lokasiSelect: officer?.lokasiTugas
        ? (lokasiInList ? officer.lokasiTugas : LAINNYA)
        : "",
      lokasiCustom: officer?.lokasiTugas && !lokasiInList ? officer.lokasiTugas : "",
      telepon: officer?.telepon ?? "",
      email: officer?.email ?? "",
      status: officer?.status ?? "aktif",
      tanggalMasuk: officer ? toDateInput(officer.tanggalMasuk) : todayStr,
      catatan: officer?.catatan ?? "",
      reguId: officer?.reguId ?? "",
      seragam: officer?.seragam ?? "",
    },
  });

  const jabatanSelectVal = form.watch("jabatanSelect");
  const lokasiSelectVal = form.watch("lokasiSelect");

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const jabatan = values.jabatanSelect === LAINNYA
        ? (values.jabatanCustom?.trim() ?? "")
        : values.jabatanSelect;
      const lokasiTugas = values.lokasiSelect === LAINNYA
        ? (values.lokasiCustom?.trim() ?? "")
        : values.lokasiSelect;

      const payload = {
        nama: values.nama.trim(),
        nik: values.nik.trim(),
        jabatan,
        telepon: values.telepon?.trim() || undefined,
        email: values.email?.trim() || undefined,
        lokasiTugas,
        status: values.status,
        tanggalMasuk: values.tanggalMasuk
          ? new Date(`${values.tanggalMasuk}T00:00:00Z`).toISOString()
          : undefined,
        catatan: values.catatan?.trim() || undefined,
        reguId: (values.reguId && values.reguId !== "none" ? values.reguId : undefined) as Id<"regu"> | undefined,
        seragam: values.seragam?.trim() || undefined,
      };
      if (officer) {
        await update({ officerId: officer._id, ...payload });
        toast.success("Data petugas diperbarui");
      } else {
        await create(payload);
        toast.success("Petugas ditambahkan");
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Gagal menyimpan data petugas");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {officer ? "Ubah Data Petugas" : "Tambah Petugas"}
          </DialogTitle>
          <DialogDescription>
            Lengkapi identitas dan penempatan petugas keamanan.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            id="officer-form"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Nama */}
              <FormField
                control={form.control}
                name="nama"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama lengkap</FormLabel>
                    <FormControl>
                      <Input placeholder="Budi Santoso" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* NIK */}
              <FormField
                control={form.control}
                name="nik"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIK / ID Petugas</FormLabel>
                    <FormControl>
                      <Input placeholder="SEC-00123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Jabatan Select */}
              <FormField
                control={form.control}
                name="jabatanSelect"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jabatan</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih jabatan..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(jabatanList ?? []).map((j) => (
                          <SelectItem key={j._id} value={j.nama}>{j.nama}</SelectItem>
                        ))}
                        <SelectItem value={LAINNYA}>Lainnya...</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {jabatanSelectVal === LAINNYA && (
                <FormField
                  control={form.control}
                  name="jabatanCustom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jabatan (lainnya)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ketik jabatan..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Lokasi Select */}
              <FormField
                control={form.control}
                name="lokasiSelect"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Penempatan</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih penempatan..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(lokasiList ?? []).map((l) => (
                          <SelectItem key={l._id} value={l.nama}>{l.nama}</SelectItem>
                        ))}
                        <SelectItem value={LAINNYA}>Lainnya...</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {lokasiSelectVal === LAINNYA && (
                <FormField
                  control={form.control}
                  name="lokasiCustom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Penempatan (lainnya)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ketik lokasi..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Telepon */}
              <FormField
                control={form.control}
                name="telepon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telepon</FormLabel>
                    <FormControl>
                      <Input placeholder="08123456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="example@gmail.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="aktif">Aktif</SelectItem>
                        <SelectItem value="cuti">Cuti</SelectItem>
                        <SelectItem value="nonaktif">Nonaktif</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Tanggal Masuk */}
              <FormField
                control={form.control}
                name="tanggalMasuk"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal masuk</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Regu */}
              <FormField
                control={form.control}
                name="reguId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regu <span className="text-muted-foreground text-xs">(opsional)</span></FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih regu..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">— Tidak ada —</SelectItem>
                        {(reguList ?? []).map((r) => (
                          <SelectItem key={r._id} value={r._id}>{r.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Seragam */}
              <FormField
                control={form.control}
                name="seragam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seragam <span className="text-muted-foreground text-xs">(opsional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: PDL, L, XL" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Catatan */}
            <FormField
              control={form.control}
              name="catatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        {officer && <LinkAkunSection officer={officer} />}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="officer-form" disabled={submitting}>
            {submitting && <Spinner className="size-4" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
