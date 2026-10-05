import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  UsersRound,
  ShieldCheck,
  UserCog,
  CalendarClock,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import PageHeader from "@/components/page-header.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

type ReguItem = FunctionReturnType<typeof api.regu.list>[number];

const NONE = "none";

const schema = z.object({
  nama: z.string().min(1, "Nama regu wajib diisi"),
  danruId: z.string().optional(),
  wadanruId: z.string().optional(),
  actingDanruId: z.string().optional(),
  isNonShift: z.boolean(),
  aktif: z.boolean(),
  tanggalMulaiRotasi: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function formatTanggal(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Form Dialog ───────────────────────────────────────────────────────────

function ReguFormDialog({
  open,
  onOpenChange,
  regu,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regu?: ReguItem | null;
}) {
  const create = useMutation(api.regu.create);
  const update = useMutation(api.regu.update);
  const officers = useQuery(api.officers.list, { status: "aktif" });
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      nama: regu?.nama ?? "",
      danruId: regu?.danruId ?? "",
      wadanruId: regu?.wadanruId ?? "",
      actingDanruId: regu?.actingDanruId ?? "",
      isNonShift: regu?.isNonShift ?? false,
      aktif: regu?.aktif ?? true,
      tanggalMulaiRotasi: regu?.tanggalMulaiRotasi ?? "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const toId = (v?: string) =>
        v && v !== NONE ? (v as Id<"officers">) : undefined;
      if (regu) {
        await update({
          id: regu._id,
          nama: values.nama.trim(),
          danruId: toId(values.danruId),
          wadanruId: toId(values.wadanruId),
          actingDanruId: toId(values.actingDanruId),
          aktif: values.aktif,
          tanggalMulaiRotasi: values.tanggalMulaiRotasi?.trim() || undefined,
        });
        toast.success("Regu diperbarui");
      } else {
        await create({
          nama: values.nama.trim(),
          isNonShift: values.isNonShift,
          tanggalMulaiRotasi: values.tanggalMulaiRotasi?.trim() || undefined,
        });
        toast.success("Regu ditambahkan");
      }
      onOpenChange(false);
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal menyimpan regu";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const officerOptions = officers ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{regu ? "Ubah Regu" : "Tambah Regu"}</DialogTitle>
          <DialogDescription>
            Kelola nama regu, danru, wadanru, dan jadwal rotasi.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="regu-form">
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama regu</FormLabel>
                  <FormControl>
                    <Input placeholder="REGU 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!regu && (
              <FormField
                control={form.control}
                name="isNonShift"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 rounded-lg border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="cursor-pointer">Regu Non Shift</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Centang untuk regu NON SHIFT (tidak masuk rotasi shift).
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {regu && (
              <>
                <FormField
                  control={form.control}
                  name="danruId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Danru</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih danru..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>— Tidak ada —</SelectItem>
                          {officerOptions.map((o) => (
                            <SelectItem key={o._id} value={o._id}>
                              {o.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="wadanruId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wadanru</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih wadanru..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>— Tidak ada —</SelectItem>
                          {officerOptions.map((o) => (
                            <SelectItem key={o._id} value={o._id}>
                              {o.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="actingDanruId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Acting Danru{" "}
                        <span className="text-muted-foreground text-xs">(opsional)</span>
                      </FormLabel>
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih acting danru..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>— Tidak ada —</SelectItem>
                          {officerOptions.map((o) => (
                            <SelectItem key={o._id} value={o._id}>
                              {o.nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="aktif"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 rounded-lg border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Regu aktif</FormLabel>
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="tanggalMulaiRotasi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Tanggal mulai rotasi{" "}
                    <span className="text-muted-foreground text-xs">(opsional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="regu-form" disabled={submitting}>
            {submitting && <Spinner className="size-4" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Acting Danru Dialog ─────────────────────────────────────────────────────

function ActingDanruDialog({
  open,
  onOpenChange,
  regu,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regu: ReguItem | null;
}) {
  const setActingDanru = useMutation(api.regu.setActingDanru);
  const [selected, setSelected] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const currentWadanru = regu?.wadanru;

  const handleSave = async (value: string | undefined) => {
    if (!regu) return;
    setSubmitting(true);
    try {
      await setActingDanru({
        id: regu._id,
        actingDanruId: value && value !== NONE ? (value as Id<"officers">) : undefined,
      });
      toast.success("Acting danru diperbarui");
      onOpenChange(false);
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal menyetel acting danru";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Acting Danru — {regu?.nama}</DialogTitle>
          <DialogDescription>
            Tunjuk wadanru sebagai acting danru saat danru berhalangan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {currentWadanru ? (
            <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
              Wadanru regu ini: <strong>{currentWadanru.nama}</strong>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Regu ini belum memiliki wadanru. Anda tetap dapat memilih petugas lain sebagai acting danru.
            </div>
          )}
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih acting danru..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— Hapus acting danru —</SelectItem>
              {currentWadanru && (
                <SelectItem value={currentWadanru._id}>
                  {currentWadanru.nama} (Wadanru)
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            onClick={() => void handleSave(selected || undefined)}
            disabled={submitting || !selected}
          >
            {submitting && <Spinner className="size-4" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReguPage() {
  const { isAdmin, canManageOps, isLoading } = useRole();
  const regus = useQuery(api.regu.list, {});
  const removeRegu = useMutation(api.regu.remove);

  const [formOpen, setFormOpen] = useState(false);
  const [editRegu, setEditRegu] = useState<ReguItem | null>(null);
  const [actingOpen, setActingOpen] = useState(false);
  const [actingRegu, setActingRegu] = useState<ReguItem | null>(null);

  const canAccess = canManageOps; // supervisor & above

  const handleDelete = async (id: Id<"regu">) => {
    if (!confirm("Hapus regu ini? Petugas yang tergabung akan dilepas dari regu.")) return;
    try {
      await removeRegu({ id });
      toast.success("Regu dihapus");
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "Gagal menghapus regu";
      toast.error(msg);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!canAccess) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheck />
          </EmptyMedia>
          <EmptyTitle>Akses terbatas</EmptyTitle>
          <EmptyDescription>
            Hanya supervisor ke atas yang dapat mengelola regu.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div>
      <PageHeader
        title="Regu"
        description="Kelola regu, danru, wadanru, acting danru, dan jadwal rotasi shift."
        action={
          <Button
            className="cursor-pointer"
            onClick={() => {
              setEditRegu(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Tambah Regu
          </Button>
        }
      />

      {regus === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : regus.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersRound />
            </EmptyMedia>
            <EmptyTitle>Belum ada regu</EmptyTitle>
            <EmptyDescription>Tambahkan regu pertama untuk mulai mengatur rotasi.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={() => {
                setEditRegu(null);
                setFormOpen(true);
              }}
            >
              Tambah Regu
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {regus.map((r) => (
            <Card key={r._id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <UsersRound className="size-4 text-primary" />
                    {r.nama}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {r.isNonShift && <Badge variant="secondary">Non Shift</Badge>}
                    {!r.aktif && <Badge variant="outline">Nonaktif</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Danru</span>
                  <span className="font-medium text-right">{r.danru?.nama ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Wadanru</span>
                  <span className="font-medium text-right">{r.wadanru?.nama ?? "—"}</span>
                </div>
                {r.actingDanru && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Acting Danru</span>
                    <Badge variant="secondary" className="gap-1">
                      <UserCog className="size-3" />
                      {r.actingDanru.nama}
                    </Badge>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Anggota</span>
                  <span className="font-medium text-right">{r.jumlahAnggota} orang</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="size-3.5" /> Mulai rotasi
                  </span>
                  <span className="text-right">{formatTanggal(r.tanggalMulaiRotasi)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => {
                      setActingRegu(r);
                      setActingOpen(true);
                    }}
                  >
                    <UserCog className="mr-1.5 size-3.5" /> Acting Danru
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer"
                    onClick={() => {
                      setEditRegu(r);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="mr-1.5 size-3.5" /> Ubah
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(r._id)}
                    >
                      <Trash2 className="mr-1.5 size-3.5" /> Hapus
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReguFormDialog open={formOpen} onOpenChange={setFormOpen} regu={editRegu} />
      <ActingDanruDialog open={actingOpen} onOpenChange={setActingOpen} regu={actingRegu} />
    </div>
  );
}
