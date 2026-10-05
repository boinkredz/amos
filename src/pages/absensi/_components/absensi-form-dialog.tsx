import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
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
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";

const STATUS_OPTIONS = [
  { value: "hadir", label: "Hadir" },
  { value: "terlambat", label: "Terlambat" },
  { value: "izin", label: "Izin" },
  { value: "sakit", label: "Sakit" },
  { value: "alpha", label: "Alpha (Absen Tanpa Keterangan)" },
] as const;

const schema = z.object({
  status: z.enum(["hadir", "terlambat", "izin", "sakit", "alpha"]),
  waktuMasuk: z.string().optional(),
  waktuKeluar: z.string().optional(),
  keterlambatanMenit: z.number().optional(),
  alasan: z.string().min(5, "Alasan wajib diisi minimal 5 karakter"),
  keterangan: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type ExistingAbsensi = {
  status: "hadir" | "terlambat" | "izin" | "sakit" | "alpha";
  waktuMasuk?: string;
  waktuKeluar?: string;
  keterlambatanMenit?: number;
  keterangan?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  assignmentId: Id<"shiftAssignments">;
  siteId?: Id<"sites">;
  officerNama: string;
  shiftNama: string;
  shiftJamMulai: string;
  tanggal: string;
  existingAbsensi?: ExistingAbsensi | null;
};

function isoToLocalTime(iso: string | undefined): string {
  if (!iso) return "";
  return format(new Date(iso), "HH:mm");
}

function localTimeToIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

function hitungKeterlambatan(tanggal: string, jamMulai: string, waktuMasuk: string): number {
  const [y, mo, d] = tanggal.split("-").map(Number);
  const [sh, sm] = jamMulai.split(":").map(Number);
  const jadwal = new Date(y, mo - 1, d, sh, sm);
  const masuk = new Date(localTimeToIso(tanggal, waktuMasuk));
  return Math.max(0, Math.round((masuk.getTime() - jadwal.getTime()) / 60000));
}

export default function AbsensiFormDialog({
  open, onClose, assignmentId, officerNama, shiftNama, shiftJamMulai, tanggal, existingAbsensi,
}: Props) {
  const recordAbsensi = useMutation(api.shifts.recordAbsensi);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "hadir",
      waktuMasuk: "",
      waktuKeluar: "",
      keterlambatanMenit: undefined,
      alasan: "",
      keterangan: "",
    },
  });

  useEffect(() => {
    if (existingAbsensi) {
      form.reset({
        status: existingAbsensi.status,
        waktuMasuk: isoToLocalTime(existingAbsensi.waktuMasuk),
        waktuKeluar: isoToLocalTime(existingAbsensi.waktuKeluar),
        keterlambatanMenit: existingAbsensi.keterlambatanMenit,
        alasan: existingAbsensi.keterangan ?? "",
        keterangan: "",
      });
    } else {
      form.reset({
        status: "hadir",
        waktuMasuk: "",
        waktuKeluar: "",
        keterlambatanMenit: undefined,
        alasan: "",
        keterangan: "",
      });
    }
  }, [existingAbsensi, form, open]);

  const status = form.watch("status");
  const waktuMasukVal = form.watch("waktuMasuk");

  useEffect(() => {
    if (status === "terlambat" && waktuMasukVal && shiftJamMulai) {
      const menit = hitungKeterlambatan(tanggal, shiftJamMulai, waktuMasukVal);
      if (menit > 0) form.setValue("keterlambatanMenit", menit);
    }
  }, [waktuMasukVal, status, tanggal, shiftJamMulai, form]);

  const onSubmit = async (data: FormData) => {
    try {
      await recordAbsensi({
        assignmentId,
        status: data.status,
        waktuMasuk: data.waktuMasuk ? localTimeToIso(tanggal, data.waktuMasuk) : undefined,
        waktuKeluar: data.waktuKeluar ? localTimeToIso(tanggal, data.waktuKeluar) : undefined,
        lokasiMasuk: undefined,
        lokasiKeluar: undefined,
        fotoMasuk: undefined,
        fotoKeluar: undefined,
        keterlambatanMenit: data.status === "terlambat" ? data.keterlambatanMenit : undefined,
        keterangan: data.alasan + (data.keterangan ? `\n${data.keterangan}` : ""),
      });
      toast.success("Absensi disimpan");
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Terjadi kesalahan");
    }
  };

  const isHadirOrTerlambat = status === "hadir" || status === "terlambat";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catat Absensi Manual</DialogTitle>
        </DialogHeader>

        <div className="rounded-md bg-muted px-3 py-2 text-sm">
          <div className="font-medium">{officerNama}</div>
          <div className="text-muted-foreground">{shiftNama} ({shiftJamMulai}) · {tanggal}</div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Status */}
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status Kehadiran</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {isHadirOrTerlambat && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="waktuMasuk" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Waktu Masuk</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="waktuKeluar" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Waktu Keluar</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {status === "terlambat" && (
                  <FormField control={form.control} name="keterlambatanMenit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Keterlambatan (menit)
                        <Badge variant="secondary" className="text-xs ml-1">Otomatis</Badge>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={1} placeholder="15"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </>
            )}

            <Separator />

            {/* Alasan — mandatory */}
            <FormField control={form.control} name="alasan" render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Alasan Absensi Manual
                  <Badge variant="destructive" className="text-[10px] ml-2 px-1.5 py-0">Wajib</Badge>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Contoh: Petugas tidak membawa HP, input koreksi data, kamera rusak..."
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Catatan opsional */}
            <FormField control={form.control} name="keterangan" render={({ field }) => (
              <FormItem>
                <FormLabel>Catatan Tambahan <span className="text-muted-foreground text-xs">(opsional)</span></FormLabel>
                <FormControl><Textarea placeholder="Catatan tambahan..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? <><Loader2 className="size-4 mr-2 animate-spin" /> Menyimpan...</>
                  : "Simpan Absensi"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
