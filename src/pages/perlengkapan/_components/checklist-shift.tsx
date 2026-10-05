import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, XCircle, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

type Kondisi = "baik" | "rusak" | "hilang";

const KONDISI_CONFIG: Record<Kondisi, { label: string; icon: React.ElementType; color: string }> = {
  baik: { label: "Baik", icon: CheckCircle2, color: "text-green-600" },
  rusak: { label: "Rusak", icon: AlertTriangle, color: "text-yellow-600" },
  hilang: { label: "Hilang", icon: XCircle, color: "text-red-600" },
};

export default function ChecklistShift() {
  const myAssignment = useQuery(api.perlengkapan.getMyTodayAssignment, {});
  const [submitted, setSubmitted] = useState(false);

  if (myAssignment === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!myAssignment || !myAssignment.siteId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><ClipboardCheck /></EmptyMedia>
          <EmptyTitle>Tidak ada jadwal hari ini</EmptyTitle>
          <EmptyDescription>
            Anda tidak memiliki assignment shift hari ini atau belum ditugaskan ke site.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <h3 className="text-lg font-semibold">Checklist berhasil dikirim</h3>
        <p className="text-sm text-muted-foreground">Terima kasih sudah mengisi checklist perlengkapan.</p>
      </div>
    );
  }

  return (
    <ChecklistForm
      assignmentId={myAssignment.assignmentId as Id<"shiftAssignments">}
      siteId={myAssignment.siteId as Id<"sites">}
      tanggal={myAssignment.tanggal}
      shiftNama={myAssignment.shiftNama}
      onSubmitted={() => setSubmitted(true)}
    />
  );
}

function ChecklistForm({
  assignmentId,
  siteId,
  tanggal,
  shiftNama,
  onSubmitted,
}: {
  assignmentId: Id<"shiftAssignments">;
  siteId: Id<"sites">;
  tanggal: string;
  shiftNama: string;
  onSubmitted: () => void;
}) {
  const alat = useQuery(api.perlengkapan.listMaster, { siteId });
  const existingCek = useQuery(api.perlengkapan.getCekByAssignment, { shiftAssignmentId: assignmentId });
  const submitMutation = useMutation(api.perlengkapan.submitCek);

  const [items, setItems] = useState<
    Record<string, { kondisi: Kondisi; jumlahTersedia: string; keterangan: string }>
  >({});
  const [loading, setLoading] = useState(false);

  if (alat === undefined || existingCek === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (existingCek) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <h3 className="text-lg font-semibold">Checklist sudah diisi</h3>
        <p className="text-sm text-muted-foreground">
          Anda sudah mengisi checklist untuk shift ini hari ini.
        </p>
        <div className="mt-2 text-sm text-muted-foreground">
          Waktu cek: {format(new Date(existingCek.waktuCek), "HH:mm", { locale: idLocale })}
        </div>
      </div>
    );
  }

  const activeAlat = alat.filter((a) => a.aktif);

  if (activeAlat.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><ClipboardCheck /></EmptyMedia>
          <EmptyTitle>Belum ada alat terdaftar</EmptyTitle>
          <EmptyDescription>Admin belum mendaftarkan alat untuk site ini.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  function getItem(id: string) {
    return items[id] ?? { kondisi: "baik" as Kondisi, jumlahTersedia: "1", keterangan: "" };
  }

  function setItemField(id: string, field: string, value: string) {
    setItems((prev) => ({
      ...prev,
      [id]: { ...getItem(id), [field]: value },
    }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await submitMutation({
        shiftAssignmentId: assignmentId,
        siteId,
        tanggal,
        items: activeAlat.map((a) => {
          const item = getItem(a._id);
          return {
            perlengkapanId: a._id,
            kondisi: item.kondisi,
            jumlahTersedia: Number(item.jumlahTersedia) || 0,
            keterangan: item.keterangan || undefined,
          };
        }),
      });
      toast.success("Checklist berhasil dikirim");
      onSubmitted();
    } catch {
      toast.error("Gagal mengirim checklist");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-secondary/50 px-4 py-3 text-sm">
        <span className="font-medium">{shiftNama}</span>
        <span className="mx-2 text-muted-foreground">•</span>
        <span className="text-muted-foreground">
          {format(new Date(tanggal), "EEEE, d MMMM yyyy", { locale: idLocale })}
        </span>
      </div>

      <div className="space-y-3">
        {activeAlat.map((a) => {
          const item = getItem(a._id);
          const kondisi = item.kondisi;
          const cfg = KONDISI_CONFIG[kondisi];
          return (
          <div key={a._id} className={`rounded-xl border-l-4 border border-border bg-card p-4 space-y-3 shadow-sm ${
            kondisi === "baik" ? "border-l-green-500" : kondisi === "rusak" ? "border-l-amber-400" : "border-l-destructive"
          }`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-foreground leading-tight">{a.nama}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">Standar: {a.jumlahStandar} unit</div>
                </div>
                <cfg.icon className={`size-5 mt-0.5 ${cfg.color}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Kondisi</Label>
                  <div className="flex gap-1.5">
                    {(["baik", "rusak", "hilang"] as Kondisi[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setItemField(a._id, "kondisi", k)}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                          kondisi === k
                            ? k === "baik"
                              ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                              : k === "rusak"
                                ? "border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                                : "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            : "border-border bg-background hover:bg-secondary"
                        }`}
                      >
                        {KONDISI_CONFIG[k].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Jumlah tersedia</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-sm"
                    value={item.jumlahTersedia}
                    onChange={(e) => setItemField(a._id, "jumlahTersedia", e.target.value)}
                  />
                </div>
              </div>
              {(kondisi === "rusak" || kondisi === "hilang") && (
                <div className="space-y-1">
                  <Label className="text-xs">Keterangan</Label>
                  <Textarea
                    placeholder="Jelaskan kondisi atau lokasi terakhir..."
                    className="text-sm"
                    rows={2}
                    value={item.keterangan}
                    onChange={(e) => setItemField(a._id, "keterangan", e.target.value)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={loading}>
        {loading ? "Mengirim..." : "Kirim Checklist"}
      </Button>
    </div>
  );
}
