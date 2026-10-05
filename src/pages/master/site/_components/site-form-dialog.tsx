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
import { Switch } from "@/components/ui/switch.tsx";

const schema = z.object({
  nama: z.string().min(1, "Nama site wajib diisi"),
  kode: z.string().min(1, "Kode wajib diisi").max(10, "Maks 10 karakter").toUpperCase(),
  alamat: z.string().min(1, "Alamat wajib diisi"),
  kota: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  keterangan: z.string().optional(),
  aktif: z.boolean(),
});

type FormData = z.infer<typeof schema>;

type SiteRow = {
  _id: Id<"sites">;
  nama: string;
  kode: string;
  alamat: string;
  kota?: string;
  koordinat?: { lat: number; lng: number };
  keterangan?: string;
  aktif: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  editSite?: SiteRow | null;
};

export default function SiteFormDialog({ open, onClose, editSite }: Props) {
  const create = useMutation(api.sites.create);
  const update = useMutation(api.sites.update);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nama: "", kode: "", alamat: "", kota: "",
      lat: "", lng: "", keterangan: "", aktif: true,
    },
  });

  useEffect(() => {
    if (editSite) {
      form.reset({
        nama: editSite.nama,
        kode: editSite.kode,
        alamat: editSite.alamat,
        kota: editSite.kota ?? "",
        lat: editSite.koordinat ? String(editSite.koordinat.lat) : "",
        lng: editSite.koordinat ? String(editSite.koordinat.lng) : "",
        keterangan: editSite.keterangan ?? "",
        aktif: editSite.aktif,
      });
    } else {
      form.reset({
        nama: "", kode: "", alamat: "", kota: "",
        lat: "", lng: "", keterangan: "", aktif: true,
      });
    }
  }, [editSite, form, open]);

  const onSubmit = async (data: FormData) => {
    const koordinat =
      data.lat && data.lng
        ? { lat: parseFloat(data.lat), lng: parseFloat(data.lng) }
        : undefined;

    try {
      if (editSite) {
        await update({
          siteId: editSite._id,
          nama: data.nama,
          kode: data.kode,
          alamat: data.alamat,
          kota: data.kota || undefined,
          koordinat,
          keterangan: data.keterangan || undefined,
          aktif: data.aktif,
        });
        toast.success("Site diperbarui");
      } else {
        await create({
          nama: data.nama,
          kode: data.kode,
          alamat: data.alamat,
          kota: data.kota || undefined,
          koordinat,
          keterangan: data.keterangan || undefined,
        });
        toast.success("Site ditambahkan");
      }
      onClose();
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Terjadi kesalahan",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editSite ? "Edit Site" : "Tambah Site"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="nama" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nama Site</FormLabel>
                  <FormControl><Input placeholder="Gedung A – Jakarta" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="kode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kode</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="GDA"
                      maxLength={10}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="alamat" render={({ field }) => (
              <FormItem>
                <FormLabel>Alamat</FormLabel>
                <FormControl><Textarea placeholder="Jl. Sudirman No. 1..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="kota" render={({ field }) => (
              <FormItem>
                <FormLabel>Kota</FormLabel>
                <FormControl><Input placeholder="Jakarta" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="lat" render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitude</FormLabel>
                  <FormControl><Input placeholder="-6.200000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lng" render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitude</FormLabel>
                  <FormControl><Input placeholder="106.816666" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="keterangan" render={({ field }) => (
              <FormItem>
                <FormLabel>Keterangan</FormLabel>
                <FormControl><Textarea placeholder="Opsional..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {editSite && (
              <FormField control={form.control} name="aktif" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Site aktif</FormLabel>
                </FormItem>
              )} />
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editSite ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
