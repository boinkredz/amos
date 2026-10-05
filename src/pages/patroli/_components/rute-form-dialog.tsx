import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "convex/react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";

const NO_SITE = "none";

const schema = z.object({
  nama: z.string().min(1, "Nama rute wajib diisi"),
  siteId: z.string(),
  estimasiMenit: z.number().min(1, "Estimasi minimal 1 menit"),
  keterangan: z.string().optional(),
  aktif: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export type RuteEditData = {
  _id: Id<"rutePatroli">;
  nama: string;
  siteId?: Id<"sites">;
  estimasiMenit: number;
  keterangan?: string;
  aktif: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  editRute?: RuteEditData | null;
};

export default function RuteFormDialog({ open, onClose, editRute }: Props) {
  const sites = useQuery(api.sites.list, { aktifOnly: true });
  const createRute = useMutation(api.patroli.createRute);
  const updateRute = useMutation(api.patroli.updateRute);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nama: "", siteId: NO_SITE, estimasiMenit: 30, keterangan: "", aktif: true },
  });

  useEffect(() => {
    if (editRute) {
      form.reset({
        nama: editRute.nama,
        siteId: editRute.siteId ?? NO_SITE,
        estimasiMenit: editRute.estimasiMenit,
        keterangan: editRute.keterangan ?? "",
        aktif: editRute.aktif,
      });
    } else {
      form.reset({ nama: "", siteId: NO_SITE, estimasiMenit: 30, keterangan: "", aktif: true });
    }
  }, [editRute, form, open]);

  const onSubmit = async (data: FormData) => {
    const siteId = data.siteId === NO_SITE ? undefined : (data.siteId as Id<"sites">);
    try {
      if (editRute) {
        await updateRute({
          ruteId: editRute._id,
          nama: data.nama,
          siteId,
          estimasiMenit: data.estimasiMenit,
          keterangan: data.keterangan || undefined,
          aktif: data.aktif,
        });
        toast.success("Rute diperbarui");
      } else {
        await createRute({
          nama: data.nama,
          siteId,
          estimasiMenit: data.estimasiMenit,
          keterangan: data.keterangan || undefined,
        });
        toast.success("Rute ditambahkan");
      }
      onClose();
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Terjadi kesalahan",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editRute ? "Edit Rute Patroli" : "Tambah Rute Patroli"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="nama" render={({ field }) => (
              <FormItem>
                <FormLabel>Nama Rute</FormLabel>
                <FormControl><Input placeholder="Rute A – Gedung Utama" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="siteId" render={({ field }) => (
              <FormItem>
                <FormLabel>Site</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Pilih site..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={NO_SITE}>Tanpa Site</SelectItem>
                    {sites?.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.kode} — {s.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="estimasiMenit" render={({ field }) => (
              <FormItem>
                <FormLabel>Estimasi Durasi (menit)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
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
            <FormField control={form.control} name="aktif" render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} className="cursor-pointer" />
                </FormControl>
                <FormLabel className="!mt-0">Rute aktif</FormLabel>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editRute ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
