import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { MapPin, Loader2 } from "lucide-react";
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

const schema = z.object({
  nama: z.string().min(1, "Nama checkpoint wajib diisi"),
  urutan: z.number().min(1, "Urutan minimal 1"),
  deskripsi: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export type CheckpointEditData = {
  _id: Id<"checkpoint">;
  nama: string;
  urutan: number;
  deskripsi?: string;
  koordinat?: { lat: number; lng: number };
};

type Props = {
  open: boolean;
  onClose: () => void;
  ruteId: Id<"rutePatroli">;
  defaultUrutan: number;
  editCheckpoint?: CheckpointEditData | null;
};

export default function CheckpointFormDialog({ open, onClose, ruteId, defaultUrutan, editCheckpoint }: Props) {
  const createCp = useMutation(api.patroli.createCheckpoint);
  const updateCp = useMutation(api.patroli.updateCheckpoint);
  const [locating, setLocating] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nama: "", urutan: defaultUrutan, deskripsi: "", lat: "", lng: "" },
  });

  useEffect(() => {
    if (editCheckpoint) {
      form.reset({
        nama: editCheckpoint.nama,
        urutan: editCheckpoint.urutan,
        deskripsi: editCheckpoint.deskripsi ?? "",
        lat: editCheckpoint.koordinat ? String(editCheckpoint.koordinat.lat) : "",
        lng: editCheckpoint.koordinat ? String(editCheckpoint.koordinat.lng) : "",
      });
    } else {
      form.reset({ nama: "", urutan: defaultUrutan, deskripsi: "", lat: "", lng: "" });
    }
  }, [editCheckpoint, defaultUrutan, form, open]);

  const fillGps = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Perangkat tidak mendukung GPS");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue("lat", pos.coords.latitude.toFixed(6));
        form.setValue("lng", pos.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success("Koordinat GPS terisi");
      },
      () => {
        setLocating(false);
        toast.error("Gagal mengambil lokasi. Izinkan akses lokasi di browser.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const parseKoordinat = (data: FormData) => {
    const lat = data.lat?.trim();
    const lng = data.lng?.trim();
    if (lat && lng) {
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
        return { lat: latNum, lng: lngNum };
      }
    }
    return undefined;
  };

  const onSubmit = async (data: FormData) => {
    const koordinat = parseKoordinat(data);
    try {
      if (editCheckpoint) {
        await updateCp({
          checkpointId: editCheckpoint._id,
          nama: data.nama,
          urutan: data.urutan,
          deskripsi: data.deskripsi || undefined,
          koordinat,
        });
        toast.success("Checkpoint diperbarui");
      } else {
        await createCp({
          ruteId,
          nama: data.nama,
          urutan: data.urutan,
          deskripsi: data.deskripsi || undefined,
          koordinat,
        });
        toast.success("Checkpoint ditambahkan");
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
          <DialogTitle>{editCheckpoint ? "Edit Checkpoint" : "Tambah Checkpoint"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="nama" render={({ field }) => (
              <FormItem>
                <FormLabel>Nama Checkpoint</FormLabel>
                <FormControl><Input placeholder="Pintu masuk utama" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="urutan" render={({ field }) => (
              <FormItem>
                <FormLabel>Urutan</FormLabel>
                <FormControl>
                  <Input
                    type="number" min={1}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="deskripsi" render={({ field }) => (
              <FormItem>
                <FormLabel>Deskripsi</FormLabel>
                <FormControl><Textarea placeholder="Opsional..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <FormLabel>Koordinat (opsional)</FormLabel>
                <Button
                  type="button" variant="secondary" size="sm"
                  className="h-7 cursor-pointer gap-1 text-xs"
                  onClick={fillGps} disabled={locating}
                >
                  {locating ? <Loader2 className="size-3 animate-spin" /> : <MapPin className="size-3" />}
                  Isi dari GPS
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="lat" render={({ field }) => (
                  <FormItem>
                    <FormControl><Input type="number" step="any" placeholder="Lat" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lng" render={({ field }) => (
                  <FormItem>
                    <FormControl><Input type="number" step="any" placeholder="Lng" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editCheckpoint ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
