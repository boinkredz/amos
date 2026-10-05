import { useState, lazy, Suspense } from "react";
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
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

const GeoFencePickerMap = lazy(() => import("./geofence-picker-map.tsx"));

const schema = z.object({
  siteId: z.string().min(1, "Pilih site"),
  nama: z.string().min(1, "Nama zona wajib diisi"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(10, "Minimal 10 meter").max(10000),
  keterangan: z.string().optional(),
  aktif: z.boolean(),
});

type FormData = z.infer<typeof schema>;

type GeoFenceDoc = {
  _id: Id<"geoFence">;
  siteId: Id<"sites">;
  nama: string;
  lat: number;
  lng: number;
  radius: number;
  keterangan?: string;
  aktif: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  editZone?: GeoFenceDoc | null;
};

export default function GeoFenceFormDialog({ open, onClose, editZone }: Props) {
  const sites = useQuery(api.sites.list, { aktifOnly: true });
  const createZone = useMutation(api.geofence.create);
  const updateZone = useMutation(api.geofence.update);
  const [locating, setLocating] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editZone
      ? { siteId: editZone.siteId, nama: editZone.nama, lat: editZone.lat, lng: editZone.lng, radius: editZone.radius, keterangan: editZone.keterangan ?? "", aktif: editZone.aktif }
      : { siteId: "", nama: "Zona Utama", lat: -6.2, lng: 106.816, radius: 100, keterangan: "", aktif: true },
  });

  const fillCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolokasi tidak didukung browser ini"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue("lat", parseFloat(pos.coords.latitude.toFixed(6)));
        form.setValue("lng", parseFloat(pos.coords.longitude.toFixed(6)));
        setLocating(false);
        toast.success("Koordinat diisi dari GPS perangkat");
      },
      () => { toast.error("Gagal mendapat lokasi GPS"); setLocating(false); },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (editZone) {
        await updateZone({ zoneId: editZone._id, siteId: data.siteId as Id<"sites">, nama: data.nama, lat: data.lat, lng: data.lng, radius: data.radius, keterangan: data.keterangan || undefined, aktif: data.aktif });
        toast.success("Zona diperbarui");
      } else {
        await createZone({ siteId: data.siteId as Id<"sites">, nama: data.nama, lat: data.lat, lng: data.lng, radius: data.radius, keterangan: data.keterangan || undefined });
        toast.success("Zona ditambahkan");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Terjadi kesalahan");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editZone ? "Edit Zona Geo Fence" : "Tambah Zona Geo Fence"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="siteId" render={({ field }) => (
              <FormItem>
                <FormLabel>Site</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Pilih site..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {sites?.map((s) => <SelectItem key={s._id} value={s._id}>{s.nama} [{s.kode}]</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="nama" render={({ field }) => (
              <FormItem>
                <FormLabel>Nama Zona</FormLabel>
                <FormControl><Input placeholder="Zona Utama" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Suspense fallback={<Skeleton className="h-48 w-full rounded-lg" />}>
              <GeoFencePickerMap
                lat={form.watch("lat")}
                lng={form.watch("lng")}
                radius={form.watch("radius")}
                onLocationPick={(lat, lng) => {
                  form.setValue("lat", lat);
                  form.setValue("lng", lng);
                }}
              />
            </Suspense>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="lat" render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitude</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.000001" placeholder="-6.200000"
                      {...field} value={field.value}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lng" render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitude</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.000001" placeholder="106.816000"
                      {...field} value={field.value}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={fillCurrentLocation} disabled={locating}>
              {locating ? "Mendapatkan lokasi..." : "Isi dari GPS Perangkat"}
            </Button>
            <FormField control={form.control} name="radius" render={({ field }) => (
              <FormItem>
                <FormLabel>Radius (meter)</FormLabel>
                <FormControl>
                  <Input type="number" min={10} max={10000} placeholder="100"
                    {...field} value={field.value}
                    onChange={(e) => field.onChange(parseInt(e.target.value))} />
                </FormControl>
                <FormDescription>Jarak maksimum dari pusat zona agar check-in valid. Min 10m, maks 10km.</FormDescription>
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
            {editZone && (
              <FormField control={form.control} name="aktif" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Zona aktif</FormLabel>
                </FormItem>
              )} />
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editZone ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
