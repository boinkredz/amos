import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
import { JENIS_INSIDEN } from "@/convex/schema/insiden";
import { JENIS_INSIDEN_LABELS } from "../_lib/constants.ts";
import LampiranUpload from "./lampiran-upload.tsx";
import type { LampiranItem } from "./lampiran-upload.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { User, MapPin, Clock, FileText, Camera } from "lucide-react";

const schema = z.object({
  siteId: z.string().optional(),
  lokasiGedung: z.string().min(1, "Wajib diisi"),
  tanggal: z.string().min(1, "Wajib diisi"),
  waktu: z.string().min(1, "Wajib diisi"),
  jenisInsiden: z.string().min(1, "Pilih jenis insiden"),
  lokasiDetail: z.string().min(1, "Wajib diisi"),
  kronologi: z.string().min(10, "Uraikan minimal 10 karakter"),
  tindakan: z.string().min(5, "Wajib diisi"),
  hasilTindakan: z.string().min(5, "Wajib diisi"),
});

type FormData = z.infer<typeof schema>;

type Props = { open: boolean; onClose: () => void };

// Stepper steps
const STEPS = [
  { id: 0, label: "Lokasi & Waktu", icon: MapPin },
  { id: 1, label: "Kejadian", icon: FileText },
  { id: 2, label: "Lampiran", icon: Camera },
];

export default function BeritaAcaraFormDialog({ open, onClose }: Props) {
  const { user } = useAuth();
  const sites = useQuery(api.sites.list, { aktifOnly: true });
  const lokasiList = useQuery(api.masterData.listLokasiGedung, { aktifOnly: true });
  const createBA = useMutation(api.insiden.createBeritaAcara);
  const generateUploadUrl = useMutation(api.insiden.generateUploadUrl);

  const [lampiran, setLampiran] = useState<LampiranItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      siteId: "",
      lokasiGedung: "",
      tanggal: new Date().toISOString().split("T")[0],
      waktu: new Date().toTimeString().slice(0, 5),
      jenisInsiden: "",
      lokasiDetail: "",
      kronologi: "",
      tindakan: "",
      hasilTindakan: "",
    },
  });

  // Validasi sebelum lanjut ke step berikutnya
  async function handleNext() {
    let valid = false;
    if (step === 0) {
      valid = await form.trigger(["lokasiGedung", "tanggal", "waktu", "jenisInsiden", "lokasiDetail"]);
    } else if (step === 1) {
      valid = await form.trigger(["kronologi", "tindakan", "hasilTindakan"]);
    }
    if (valid) setStep((s) => s + 1);
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await createBA({
        siteId: data.siteId ? (data.siteId as Id<"sites">) : undefined,
        lokasiGedung: data.lokasiGedung,
        tanggal: data.tanggal,
        waktu: data.waktu,
        jenisInsiden: data.jenisInsiden as (typeof JENIS_INSIDEN)[number],
        lokasiDetail: data.lokasiDetail,
        kronologi: data.kronologi,
        tindakan: data.tindakan,
        hasilTindakan: data.hasilTindakan,
        lampiran: lampiran.map((l) => ({ storageId: l.storageId, keterangan: l.keterangan })),
      });
      toast.success("Berita Acara berhasil dibuat");
      form.reset();
      setLampiran([]);
      setStep(0);
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal membuat Berita Acara");
    } finally {
      setSubmitting(false);
    }
  };

  function handleClose() {
    form.reset();
    setLampiran([]);
    setStep(0);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 overflow-hidden max-h-[95dvh] flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-[15px] font-semibold">Buat Berita Acara</DialogTitle>
          {/* Pelapor info */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center justify-center size-6 rounded-full bg-primary/10">
              <User className="size-3.5 text-primary" />
            </div>
            <span className="text-[12px] text-muted-foreground font-medium">
              Pelapor: <span className="text-foreground font-semibold">{user?.profile?.name ?? "—"}</span>
            </span>
          </div>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-0 px-4 py-3 border-b bg-muted/30 shrink-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === i;
            const isDone = step > i;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className={`flex items-center gap-1.5 ${isActive ? "opacity-100" : isDone ? "opacity-70" : "opacity-40"}`}>
                  <div className={`flex items-center justify-center size-6 rounded-full border-2 transition-colors ${
                    isDone ? "bg-green-500 border-green-500" : isActive ? "bg-primary border-primary" : "border-border bg-background"
                  }`}>
                    {isDone ? (
                      <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <Icon className={`size-3 ${isActive ? "text-white" : "text-muted-foreground"}`} />
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold hidden sm:block ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${step > i ? "bg-green-400" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form content */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

              {/* Step 0: Lokasi & Waktu */}
              {step === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="siteId" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-[12px] font-semibold">Site (Opsional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10 text-[13px]">
                              <SelectValue placeholder="Pilih site..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sites?.map((s) => (
                              <SelectItem key={s._id} value={s._id}>{s.nama}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="lokasiGedung" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-[12px] font-semibold">Lokasi Gedung <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10 text-[13px]">
                              <SelectValue placeholder="Pilih lokasi..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {lokasiList?.map((loc) => (
                              <SelectItem key={loc._id} value={loc.nama}>{loc.nama}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="tanggal" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[12px] font-semibold">Tanggal <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="date" className="h-10 text-[13px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="waktu" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[12px] font-semibold flex items-center gap-1">
                          <Clock className="size-3" /> Waktu <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="time" className="h-10 text-[13px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="jenisInsiden" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-[12px] font-semibold">Jenis Insiden <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10 text-[13px]">
                              <SelectValue placeholder="Pilih jenis..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {JENIS_INSIDEN.map((j) => (
                              <SelectItem key={j} value={j}>{JENIS_INSIDEN_LABELS[j]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="lokasiDetail" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-[12px] font-semibold">Lokasi Detail <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input className="h-10 text-[13px]" placeholder="Lantai 2, ruang server..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </>
              )}

              {/* Step 1: Kronologi & Tindakan */}
              {step === 1 && (
                <div className="space-y-4">
                  <FormField control={form.control} name="kronologi" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[12px] font-semibold">Kronologi Kejadian <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          className="text-[13px] resize-none"
                          placeholder="Uraikan kronologi kejadian secara runtut..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="tindakan" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[12px] font-semibold">Tindakan yang Diambil <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          className="text-[13px] resize-none"
                          placeholder="Tindakan yang dilakukan petugas..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="hasilTindakan" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[12px] font-semibold">Hasil Tindakan <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          className="text-[13px] resize-none"
                          placeholder="Hasil dari tindakan yang diambil..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}

              {/* Step 2: Lampiran */}
              {step === 2 && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-muted/40 px-4 py-3 space-y-0.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ringkasan BA</p>
                    <p className="text-[13px] font-semibold text-foreground">{form.watch("jenisInsiden") ? JENIS_INSIDEN_LABELS[form.watch("jenisInsiden") as keyof typeof JENIS_INSIDEN_LABELS] : "—"}</p>
                    <p className="text-[12px] text-muted-foreground font-medium">{form.watch("lokasiGedung")} — {form.watch("lokasiDetail")}</p>
                    <p className="text-[11px] text-muted-foreground">{form.watch("tanggal")} {form.watch("waktu")}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold mb-2">Lampiran Foto <span className="text-muted-foreground font-normal">(opsional)</span></p>
                    <LampiranUpload value={lampiran} onChange={setLampiran} />
                  </div>
                </div>
              )}
            </div>

            {/* Footer navigasi */}
            <div className="px-4 py-3 border-t bg-background shrink-0 flex gap-2">
              {step > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 h-10 text-[13px] font-semibold"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Kembali
                </Button>
              )}
              {step === 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 h-10 text-[13px] font-semibold"
                  onClick={handleClose}
                >
                  Batal
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  className="flex-1 h-10 text-[13px] font-semibold"
                  onClick={handleNext}
                >
                  Lanjut
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="flex-1 h-10 text-[13px] font-semibold"
                  disabled={submitting}
                >
                  {submitting ? "Menyimpan..." : "Kirim BA"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
