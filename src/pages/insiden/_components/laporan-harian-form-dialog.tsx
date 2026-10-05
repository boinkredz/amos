import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import LampiranUpload from "./lampiran-upload.tsx";
import type { LampiranItem } from "./lampiran-upload.tsx";

const cekFisikSchema = z.object({
  nama: z.string().min(1), jabatan: z.string().min(1), posRotasi: z.string().min(1),
  kondisiFisik: z.string().min(1), kelengkapanKerja: z.string().min(1), keterangan: z.string().optional(),
});

const cekPeralatanSchema = z.object({
  namaAlat: z.string().min(1), jmlStandar: z.number().min(0), jmlTersedia: z.number().min(0),
  kondisi: z.string().min(1), keterangan: z.string().optional(),
});

const schema = z.object({
  siteId: z.string().optional(),
  tanggal: z.string().min(1),
  shift: z.string().min(1),
  namaPembuat: z.string().min(1),
  jabatanPembuat: z.string().min(1),
  namaAtasan: z.string().optional(),
  jabatanAtasan: z.string().optional(),
  lokasiGedung: z.string().min(1),
  personilHarusnya: z.number().min(0),
  personilHadir: z.number().min(0),
  statusKehadiran: z.enum(["lengkap", "tidak_lengkap"]),
  adaTerlambat: z.boolean(),
  detailTerlambat: z.string().optional(),
  adaAbsen: z.boolean(),
  detailAbsen: z.string().optional(),
  detailBackup: z.string().optional(),
  cekFisik: z.array(cekFisikSchema),
  cekPeralatan: z.array(cekPeralatanSchema),
  adaDinamika: z.boolean(),
  dinamika: z.string().optional(),
  adaInfoRegu: z.boolean(),
  detailInfoRegu: z.string().optional(),
  adaEskalasi: z.boolean(),
  detailEskalasi: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type Props = { open: boolean; onClose: () => void };

/** Read-only display field for auto-filled values */
function ReadOnlyField({ value }: { value: string }) {
  return (
    <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
      {value || "—"}
    </div>
  );
}

export default function LaporanHarianFormDialog({ open, onClose }: Props) {
  const sites = useQuery(api.sites.list, { aktifOnly: true });
  const lokasiList = useQuery(api.masterData.listLokasiGedung, { aktifOnly: true });
  const shiftList = useQuery(api.shifts.listShifts, {});
  const myProfile = useQuery(api.officers.getMyOfficerWithAtasan, {});
  const createLaporan = useMutation(api.insiden.createLaporanHarian);
  const [lampiran, setLampiran] = useState<LampiranItem[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      siteId: "", tanggal: new Date().toISOString().split("T")[0], shift: "",
      namaPembuat: "", jabatanPembuat: "", namaAtasan: "", jabatanAtasan: "",
      lokasiGedung: "", personilHarusnya: 0, personilHadir: 0, statusKehadiran: "lengkap",
      adaTerlambat: false, detailTerlambat: "", adaAbsen: false, detailAbsen: "",
      detailBackup: "", cekFisik: [], cekPeralatan: [],
      adaDinamika: false, dinamika: "", adaInfoRegu: false, detailInfoRegu: "",
      adaEskalasi: false, detailEskalasi: "",
    },
  });

  const watchedTanggal = form.watch("tanggal");
  const watchedSiteId = form.watch("siteId");

  // Auto-fill absensi stats when date/site changes
  const absensiStats = useQuery(
    api.shifts.absensiStatsForDate,
    watchedTanggal
      ? {
          tanggal: watchedTanggal,
          siteId: watchedSiteId ? (watchedSiteId as Id<"sites">) : undefined,
        }
      : "skip",
  );

  // Auto-fill nama, jabatan, atasan from officer profile/hierarchy
  useEffect(() => {
    if (myProfile) {
      form.setValue("namaPembuat", myProfile.officer.nama);
      form.setValue("jabatanPembuat", myProfile.officer.jabatan ?? "");
      if (myProfile.atasan) {
        form.setValue("namaAtasan", myProfile.atasan.nama);
        form.setValue("jabatanAtasan", myProfile.atasan.jabatan ?? "");
      }
    }
  }, [myProfile, form]);

  // Auto-fill personil stats from absensi
  useEffect(() => {
    if (absensiStats) {
      form.setValue("personilHarusnya", absensiStats.personilHarusnya);
      form.setValue("personilHadir", absensiStats.personilHadir);
      form.setValue("statusKehadiran", absensiStats.statusKehadiran as "lengkap" | "tidak_lengkap");
    }
  }, [absensiStats, form]);

  const fisikArray = useFieldArray({ control: form.control, name: "cekFisik" });
  const alatArray = useFieldArray({ control: form.control, name: "cekPeralatan" });

  const hasProfile = !!myProfile;
  const hasAtasan = !!myProfile?.atasan;

  const onSubmit = async (data: FormData) => {
    try {
      await createLaporan({
        siteId: data.siteId ? (data.siteId as Id<"sites">) : undefined,
        tanggal: data.tanggal, shift: data.shift,
        namaPembuat: data.namaPembuat, jabatanPembuat: data.jabatanPembuat,
        namaAtasan: data.namaAtasan || undefined, jabatanAtasan: data.jabatanAtasan || undefined,
        lokasiGedung: data.lokasiGedung,
        personilHarusnya: data.personilHarusnya, personilHadir: data.personilHadir,
        statusKehadiran: data.statusKehadiran,
        adaTerlambat: data.adaTerlambat, detailTerlambat: data.detailTerlambat || undefined,
        adaAbsen: data.adaAbsen, detailAbsen: data.detailAbsen || undefined,
        detailBackup: data.detailBackup || undefined,
        cekFisik: data.cekFisik, cekPeralatan: data.cekPeralatan,
        adaDinamika: data.adaDinamika, dinamika: data.dinamika || undefined,
        adaInfoRegu: data.adaInfoRegu, detailInfoRegu: data.detailInfoRegu || undefined,
        adaEskalasi: data.adaEskalasi, detailEskalasi: data.detailEskalasi || undefined,
        lampiran: lampiran.map((l) => ({ storageId: l.storageId, keterangan: l.keterangan })),
      });
      toast.success("Laporan Harian berhasil dibuat");
      form.reset();
      setLampiran([]);
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal membuat laporan");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Buat Laporan Harian</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Section 1: Identitas */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identitas</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField control={form.control} name="siteId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger></FormControl>
                      <SelectContent>{sites?.map((s) => <SelectItem key={s._id} value={s._id}>{s.nama}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tanggal" render={({ field }) => (
                  <FormItem><FormLabel>Tanggal</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                {/* Shift — select from shift templates */}
                <FormField control={form.control} name="shift" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Pilih shift..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {shiftList?.map((s) => (
                          <SelectItem key={s._id} value={s.nama}>
                            {s.nama} ({s.jamMulai}–{s.jamSelesai})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Nama & jabatan — auto dari profil + hierarki */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="namaPembuat" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Pembuat</FormLabel>
                    {hasProfile
                      ? <ReadOnlyField value={field.value} />
                      : <FormControl><Input {...field} /></FormControl>
                    }
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="jabatanPembuat" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jabatan Pembuat</FormLabel>
                    {hasProfile
                      ? <ReadOnlyField value={field.value} />
                      : <FormControl><Input {...field} /></FormControl>
                    }
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="namaAtasan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Atasan <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel>
                    {hasAtasan
                      ? <ReadOnlyField value={field.value ?? ""} />
                      : <FormControl><Input {...field} /></FormControl>
                    }
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="jabatanAtasan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jabatan Atasan <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel>
                    {hasAtasan
                      ? <ReadOnlyField value={field.value ?? ""} />
                      : <FormControl><Input {...field} /></FormControl>
                    }
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="lokasiGedung" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lokasi Gedung</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih lokasi..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {lokasiList?.map((loc) => <SelectItem key={loc._id} value={loc.nama}>{loc.nama}</SelectItem>)}
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </section>

            {/* Section 2: Personil — auto dari absensi */}
            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kehadiran Personil</h4>
                {absensiStats && (
                  <span className="text-xs text-muted-foreground">Otomatis dari data absensi</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="personilHarusnya" render={({ field }) => (
                  <FormItem><FormLabel>Seharusnya</FormLabel><FormControl><Input type="number" min={0} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="personilHadir" render={({ field }) => (
                  <FormItem><FormLabel>Hadir</FormLabel><FormControl><Input type="number" min={0} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="statusKehadiran" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="lengkap">Lengkap</SelectItem>
                        <SelectItem value="tidak_lengkap">Tidak Lengkap</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="adaTerlambat" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="!mt-0">Ada keterlambatan</FormLabel>
                </FormItem>
              )} />
              {form.watch("adaTerlambat") && (
                <FormField control={form.control} name="detailTerlambat" render={({ field }) => (
                  <FormItem><FormControl><Textarea placeholder="Nama dan durasi terlambat..." rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}

              <FormField control={form.control} name="adaAbsen" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="!mt-0">Ada yang absen</FormLabel>
                </FormItem>
              )} />
              {form.watch("adaAbsen") && (
                <>
                  <FormField control={form.control} name="detailAbsen" render={({ field }) => (
                    <FormItem><FormControl><Textarea placeholder="Detail absen..." rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="detailBackup" render={({ field }) => (
                    <FormItem><FormLabel>Detail Backup</FormLabel><FormControl><Textarea placeholder="Siapa yang backup..." rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </>
              )}
            </section>

            {/* Section 3: Cek Fisik */}
            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pengecekan Fisik Personil</h4>
                <Button type="button" variant="secondary" size="sm" className="cursor-pointer" onClick={() => fisikArray.append({ nama: "", jabatan: "", posRotasi: "", kondisiFisik: "Baik", kelengkapanKerja: "Lengkap", keterangan: "" })}>
                  <Plus className="mr-1 h-3 w-3" /> Tambah
                </Button>
              </div>
              {fisikArray.fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-6 gap-2 items-end rounded border p-2">
                  <FormField control={form.control} name={`cekFisik.${i}.nama`} render={({ field: f }) => (
                    <FormItem><FormLabel className="text-xs">Nama</FormLabel><FormControl><Input className="text-xs" {...f} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`cekFisik.${i}.jabatan`} render={({ field: f }) => (
                    <FormItem><FormLabel className="text-xs">Jabatan</FormLabel><FormControl><Input className="text-xs" {...f} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`cekFisik.${i}.posRotasi`} render={({ field: f }) => (
                    <FormItem><FormLabel className="text-xs">Pos/Rotasi</FormLabel><FormControl><Input className="text-xs" {...f} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`cekFisik.${i}.kondisiFisik`} render={({ field: f }) => (
                    <FormItem><FormLabel className="text-xs">Fisik</FormLabel><FormControl><Input className="text-xs" {...f} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`cekFisik.${i}.kelengkapanKerja`} render={({ field: f }) => (
                    <FormItem><FormLabel className="text-xs">Kelengkapan</FormLabel><FormControl><Input className="text-xs" {...f} /></FormControl></FormItem>
                  )} />
                  <Button type="button" variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={() => fisikArray.remove(i)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </section>

            {/* Section 4: Cek Peralatan */}
            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pengecekan Peralatan</h4>
                <Button type="button" variant="secondary" size="sm" className="cursor-pointer" onClick={() => alatArray.append({ namaAlat: "", jmlStandar: 0, jmlTersedia: 0, kondisi: "Baik", keterangan: "" })}>
                  <Plus className="mr-1 h-3 w-3" /> Tambah
                </Button>
              </div>
              {alatArray.fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-6 gap-2 items-end rounded border p-2">
                  <FormField control={form.control} name={`cekPeralatan.${i}.namaAlat`} render={({ field: f }) => (
                    <FormItem><FormLabel className="text-xs">Nama Alat</FormLabel><FormControl><Input className="text-xs" {...f} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`cekPeralatan.${i}.jmlStandar`} render={({ field: f }) => (
                    <FormItem><FormLabel className="text-xs">Std</FormLabel><FormControl><Input type="number" className="text-xs" {...f} onChange={(e) => f.onChange(parseInt(e.target.value) || 0)} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`cekPeralatan.${i}.jmlTersedia`} render={({ field: f }) => (
                    <FormItem><FormLabel className="text-xs">Ada</FormLabel><FormControl><Input type="number" className="text-xs" {...f} onChange={(e) => f.onChange(parseInt(e.target.value) || 0)} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`cekPeralatan.${i}.kondisi`} render={({ field: f }) => (
                    <FormItem><FormLabel className="text-xs">Kondisi</FormLabel><FormControl><Input className="text-xs" {...f} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`cekPeralatan.${i}.keterangan`} render={({ field: f }) => (
                    <FormItem><FormLabel className="text-xs">Ket.</FormLabel><FormControl><Input className="text-xs" {...f} /></FormControl></FormItem>
                  )} />
                  <Button type="button" variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={() => alatArray.remove(i)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </section>

            {/* Section 5: Dinamika */}
            <section className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dinamika & Eskalasi</h4>
              <FormField control={form.control} name="adaDinamika" render={({ field }) => (
                <FormItem className="flex items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Ada dinamika/hal menonjol</FormLabel></FormItem>
              )} />
              {form.watch("adaDinamika") && (
                <FormField control={form.control} name="dinamika" render={({ field }) => (
                  <FormItem><FormControl><Textarea rows={3} placeholder="Komplain, pelanggaran, monitoring area, dll..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}

              <FormField control={form.control} name="adaInfoRegu" render={({ field }) => (
                <FormItem className="flex items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Ada info untuk regu berikutnya</FormLabel></FormItem>
              )} />
              {form.watch("adaInfoRegu") && (
                <FormField control={form.control} name="detailInfoRegu" render={({ field }) => (
                  <FormItem><FormControl><Textarea rows={2} placeholder="Info penting untuk shift berikutnya..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}

              <FormField control={form.control} name="adaEskalasi" render={({ field }) => (
                <FormItem className="flex items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Ada eskalasi</FormLabel></FormItem>
              )} />
              {form.watch("adaEskalasi") && (
                <FormField control={form.control} name="detailEskalasi" render={({ field }) => (
                  <FormItem><FormControl><Textarea rows={2} placeholder="Detail eskalasi..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
            </section>

            {/* Section 6: Lampiran */}
            <section className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lampiran</h4>
              <LampiranUpload value={lampiran} onChange={setLampiran} />
            </section>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
