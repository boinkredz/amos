import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { User, Users } from "lucide-react";
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
import { cn } from "@/lib/utils.ts";

const schema = z.object({
  mode: z.union([z.literal("individu"), z.literal("regu")]),
  officerId: z.string().optional(),
  reguId: z.string().optional(),
  ruteId: z.string().min(1, "Pilih rute"),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  jamMulaiRencana: z.string().min(1, "Jam mulai wajib diisi"),
  jamSelesaiRencana: z.string().min(1, "Jam selesai wajib diisi"),
  catatan: z.string().optional(),
}).refine(
  (d) => d.mode !== "individu" || (d.officerId && d.officerId.length > 0),
  { message: "Pilih petugas", path: ["officerId"] },
).refine(
  (d) => d.mode !== "regu" || (d.reguId && d.reguId.length > 0),
  { message: "Pilih regu", path: ["reguId"] },
);

type FormData = z.infer<typeof schema>;

export type PenugasanEditData = {
  _id: Id<"tugasPatroli">;
  officerId: Id<"officers">;
  ruteId: Id<"rutePatroli">;
  tanggal: string;
  jamMulaiRencana: string;
  jamSelesaiRencana: string;
  catatan?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultTanggal: string;
  editPenugasan?: PenugasanEditData | null;
};

export default function PenugasanFormDialog({ open, onClose, defaultTanggal, editPenugasan }: Props) {
  const officers = useQuery(api.officers.list, {}) ?? [];
  const rutes = useQuery(api.patroli.listRute, { aktifOnly: true }) ?? [];
  const regus = useQuery(api.regu.listAktif, {}) ?? [];
  const createTugas = useMutation(api.patroli.createTugas);
  const createTugasRegu = useMutation(api.patroli.createTugasRegu);
  const updateTugas = useMutation(api.patroli.updateTugas);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: "individu",
      officerId: "",
      reguId: "",
      ruteId: "",
      tanggal: defaultTanggal,
      jamMulaiRencana: "08:00",
      jamSelesaiRencana: "09:00",
      catatan: "",
    },
  });

  const mode = form.watch("mode");

  useEffect(() => {
    if (editPenugasan) {
      form.reset({
        mode: "individu",
        officerId: editPenugasan.officerId,
        reguId: "",
        ruteId: editPenugasan.ruteId,
        tanggal: editPenugasan.tanggal,
        jamMulaiRencana: editPenugasan.jamMulaiRencana,
        jamSelesaiRencana: editPenugasan.jamSelesaiRencana,
        catatan: editPenugasan.catatan ?? "",
      });
    } else {
      form.reset({
        mode: "individu",
        officerId: "",
        reguId: "",
        ruteId: "",
        tanggal: defaultTanggal,
        jamMulaiRencana: "08:00",
        jamSelesaiRencana: "09:00",
        catatan: "",
      });
    }
  }, [editPenugasan, defaultTanggal, form, open]);

  const onSubmit = async (data: FormData) => {
    try {
      if (editPenugasan) {
        await updateTugas({
          tugasId: editPenugasan._id,
          officerId: data.officerId as Id<"officers">,
          ruteId: data.ruteId as Id<"rutePatroli">,
          tanggal: data.tanggal,
          jamMulaiRencana: data.jamMulaiRencana,
          jamSelesaiRencana: data.jamSelesaiRencana,
          catatan: data.catatan || undefined,
        });
        toast.success("Penugasan diperbarui");
      } else if (data.mode === "regu") {
        const jumlah = await createTugasRegu({
          reguId: data.reguId as Id<"regu">,
          ruteId: data.ruteId as Id<"rutePatroli">,
          tanggal: data.tanggal,
          jamMulaiRencana: data.jamMulaiRencana,
          jamSelesaiRencana: data.jamSelesaiRencana,
          catatan: data.catatan || undefined,
        });
        toast.success(`${jumlah} penugasan dibuat untuk anggota regu`);
      } else {
        await createTugas({
          officerId: data.officerId as Id<"officers">,
          ruteId: data.ruteId as Id<"rutePatroli">,
          tanggal: data.tanggal,
          jamMulaiRencana: data.jamMulaiRencana,
          jamSelesaiRencana: data.jamSelesaiRencana,
          catatan: data.catatan || undefined,
        });
        toast.success("Penugasan ditambahkan");
      }
      onClose();
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menyimpan",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editPenugasan ? "Edit Penugasan Patroli" : "Jadwalkan Patroli"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!editPenugasan && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={mode === "individu" ? "default" : "secondary"}
                  className={cn("cursor-pointer gap-2", mode === "individu" && "ring-2 ring-primary/40")}
                  onClick={() => form.setValue("mode", "individu")}
                >
                  <User className="size-4" /> Individu
                </Button>
                <Button
                  type="button"
                  variant={mode === "regu" ? "default" : "secondary"}
                  className={cn("cursor-pointer gap-2", mode === "regu" && "ring-2 ring-primary/40")}
                  onClick={() => form.setValue("mode", "regu")}
                >
                  <Users className="size-4" /> Per Regu
                </Button>
              </div>
            )}

            {mode === "individu" ? (
              <FormField control={form.control} name="officerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Petugas</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih petugas..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {officers?.map((o) => (
                        <SelectItem key={o._id} value={o._id}>{o.nama} — {o.jabatan}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            ) : (
              <FormField control={form.control} name="reguId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Regu</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih regu..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {regus?.map((r) => (
                        <SelectItem key={r._id} value={r._id}>{r.nama} ({r.jumlahAnggota} anggota)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Tugas dibuat otomatis untuk semua anggota aktif dalam regu.
                  </p>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="ruteId" render={({ field }) => (
              <FormItem>
                <FormLabel>Rute Patroli</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Pilih rute..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {rutes?.map((r) => (
                      <SelectItem key={r._id} value={r._id}>{r.nama} ({r.estimasiMenit} menit)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="tanggal" render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="jamMulaiRencana" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jam Mulai</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="jamSelesaiRencana" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jam Selesai</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="catatan" render={({ field }) => (
              <FormItem>
                <FormLabel>Catatan</FormLabel>
                <FormControl><Textarea placeholder="Opsional..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editPenugasan ? "Simpan" : "Jadwalkan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
