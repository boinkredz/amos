import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";

const WARNA_OPTIONS = [
  { hex: "#3B82F6", label: "Biru" },
  { hex: "#10B981", label: "Hijau" },
  { hex: "#F59E0B", label: "Kuning" },
  { hex: "#EF4444", label: "Merah" },
  { hex: "#8B5CF6", label: "Ungu" },
  { hex: "#EC4899", label: "Pink" },
  { hex: "#06B6D4", label: "Cyan" },
  { hex: "#6B7280", label: "Abu-abu" },
];

const schema = z.object({
  nama: z.string().min(1, "Nama shift wajib diisi"),
  jamMulai: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  jamSelesai: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  warnaTema: z.string().optional(),
  keterangan: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type ShiftRow = {
  _id: Id<"shifts">;
  nama: string;
  jamMulai: string;
  jamSelesai: string;
  warnaTema?: string;
  keterangan?: string;
};

type Props = { open: boolean; onClose: () => void; editShift?: ShiftRow | null };

export default function ShiftFormDialog({ open, onClose, editShift }: Props) {
  const createShift = useMutation(api.shifts.createShift);
  const updateShift = useMutation(api.shifts.updateShift);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nama: "", jamMulai: "08:00", jamSelesai: "16:00", warnaTema: "#3B82F6", keterangan: "" },
  });

  useEffect(() => {
    if (editShift) {
      form.reset({
        nama: editShift.nama,
        jamMulai: editShift.jamMulai,
        jamSelesai: editShift.jamSelesai,
        warnaTema: editShift.warnaTema ?? "#3B82F6",
        keterangan: editShift.keterangan ?? "",
      });
    } else {
      form.reset({ nama: "", jamMulai: "08:00", jamSelesai: "16:00", warnaTema: "#3B82F6", keterangan: "" });
    }
  }, [editShift, form, open]);

  const onSubmit = async (data: FormData) => {
    try {
      if (editShift) {
        await updateShift({ shiftId: editShift._id, ...data });
        toast.success("Shift diperbarui");
      } else {
        await createShift(data);
        toast.success("Shift ditambahkan");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Terjadi kesalahan");
    }
  };

  const selectedWarna = form.watch("warnaTema");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editShift ? "Edit Shift" : "Tambah Shift"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="nama" render={({ field }) => (
              <FormItem>
                <FormLabel>Nama Shift</FormLabel>
                <FormControl><Input placeholder="Shift Pagi" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="jamMulai" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jam Mulai</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="jamSelesai" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jam Selesai</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Color picker */}
            <FormField control={form.control} name="warnaTema" render={({ field }) => (
              <FormItem>
                <FormLabel>Warna Tema</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {WARNA_OPTIONS.map((w) => (
                    <button
                      key={w.hex}
                      type="button"
                      title={w.label}
                      onClick={() => field.onChange(w.hex)}
                      className="size-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: w.hex,
                        borderColor: selectedWarna === w.hex ? "#fff" : "transparent",
                        outline: selectedWarna === w.hex ? `2px solid ${w.hex}` : "none",
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="keterangan" render={({ field }) => (
              <FormItem>
                <FormLabel>Keterangan</FormLabel>
                <FormControl><Textarea placeholder="Opsional..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editShift ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
