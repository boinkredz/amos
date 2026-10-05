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

const schema = z.object({
  officerId: z.string().min(1, "Pilih petugas"),
  shiftId: z.string().min(1, "Pilih shift"),
  siteId: z.string().optional(),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  catatan: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type EditAssignment = {
  _id: Id<"shiftAssignments">;
  officerId: Id<"officers">;
  shiftId: Id<"shifts">;
  siteId?: Id<"sites">;
  tanggal: string;
  catatan?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
  editAssignment?: EditAssignment | null;
};

export default function AssignmentFormDialog({ open, onClose, defaultDate, editAssignment }: Props) {
  const officers = useQuery(api.officers.list, {});
  const shifts = useQuery(api.shifts.listShifts, {});
  const sites = useQuery(api.sites.list, { aktifOnly: true });
  const createAssignment = useMutation(api.shifts.createAssignment);
  const updateAssignment = useMutation(api.shifts.updateAssignment);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { officerId: "", shiftId: "", siteId: "", tanggal: defaultDate ?? "", catatan: "" },
  });

  useEffect(() => {
    if (editAssignment) {
      form.reset({
        officerId: editAssignment.officerId,
        shiftId: editAssignment.shiftId,
        siteId: editAssignment.siteId ?? "",
        tanggal: editAssignment.tanggal,
        catatan: editAssignment.catatan ?? "",
      });
    } else {
      form.reset({ officerId: "", shiftId: "", siteId: "", tanggal: defaultDate ?? "", catatan: "" });
    }
  }, [editAssignment, form, open, defaultDate]);

  const onSubmit = async (data: FormData) => {
    try {
      if (editAssignment) {
        await updateAssignment({
          assignmentId: editAssignment._id,
          shiftId: data.shiftId as Id<"shifts">,
          siteId: data.siteId ? (data.siteId as Id<"sites">) : undefined,
          catatan: data.catatan || undefined,
        });
        toast.success("Jadwal diperbarui");
      } else {
        await createAssignment({
          officerId: data.officerId as Id<"officers">,
          shiftId: data.shiftId as Id<"shifts">,
          siteId: data.siteId ? (data.siteId as Id<"sites">) : undefined,
          tanggal: data.tanggal,
          catatan: data.catatan || undefined,
        });
        toast.success("Jadwal ditambahkan");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Terjadi kesalahan");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editAssignment ? "Edit Jadwal" : "Tambah Jadwal Shift"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!editAssignment && (
              <FormField control={form.control} name="officerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Petugas</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih petugas..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {officers?.filter((o) => o.status === "aktif").map((o) => (
                        <SelectItem key={o._id} value={o._id}>{o.nama} — {o.jabatan}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <FormField control={form.control} name="shiftId" render={({ field }) => (
              <FormItem>
                <FormLabel>Shift</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Pilih shift..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {shifts?.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        <div className="flex items-center gap-2">
                          <div className="size-2.5 rounded-full" style={{ backgroundColor: s.warnaTema ?? "#6B7280" }} />
                          {s.nama} ({s.jamMulai}–{s.jamSelesai})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="siteId" render={({ field }) => (
              <FormItem>
                <FormLabel>Site (opsional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Semua site..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">— Semua / Tidak spesifik —</SelectItem>
                    {sites?.map((s) => (
                      <SelectItem key={s._id} value={s._id}>{s.nama} [{s.kode}]</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {!editAssignment && (
              <FormField control={form.control} name="tanggal" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
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
                {editAssignment ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
