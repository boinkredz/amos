import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import { CalendarDays, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { format } from "date-fns";

type Pola = "setiap_hari" | "senin_jumat" | "senin_sabtu";

const POLA_LABELS: Record<Pola, string> = {
  setiap_hari: "Setiap hari (bisa pakai siklus libur)",
  senin_jumat: "Senin–Jumat",
  senin_sabtu: "Senin–Sabtu",
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function GenerateJadwalDialog({ open, onClose }: Props) {
  const officers = useQuery(api.officers.list, { status: "aktif" });
  const shifts = useQuery(api.shifts.listShifts, {});
  const sites = useQuery(api.sites.list, {});
  const generateMutation = useMutation(api.shifts.generateSchedule);
  const previewMutation = useMutation(api.shifts.previewSchedule);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [selectedOfficers, setSelectedOfficers] = useState<Set<string>>(new Set());
  const [shiftId, setShiftId] = useState("");
  const [siteId, setSiteId] = useState("none");
  const [tanggalMulai, setTanggalMulai] = useState(todayStr);
  const [tanggalSelesai, setTanggalSelesai] = useState(todayStr);
  const [pola, setPola] = useState<Pola>("setiap_hari");
  const [siklus, setSiklus] = useState("4");
  const [liburPerSiklus, setLiburPerSiklus] = useState("1");
  const [preview, setPreview] = useState<{ willCreate: number; willSkip: number } | null>(null);
  const [step, setStep] = useState<"form" | "preview">("form");
  const [loading, setLoading] = useState(false);

  function toggleOfficer(id: string) {
    setSelectedOfficers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!officers) return;
    if (selectedOfficers.size === officers.length) {
      setSelectedOfficers(new Set());
    } else {
      setSelectedOfficers(new Set(officers.map((o) => o._id)));
    }
  }

  async function handlePreview() {
    if (!shiftId || selectedOfficers.size === 0) {
      toast.error("Pilih shift dan minimal 1 petugas");
      return;
    }
    if (tanggalMulai > tanggalSelesai) {
      toast.error("Tanggal mulai harus sebelum tanggal selesai");
      return;
    }
    setLoading(true);
    try {
      const result = await previewMutation({
        officerIds: [...selectedOfficers] as Id<"officers">[],
        shiftId: shiftId as Id<"shifts">,
        tanggalMulai,
        tanggalSelesai,
        pola,
        siklus: pola === "setiap_hari" ? Number(siklus) : undefined,
        liburPerSiklus: pola === "setiap_hari" ? Number(liburPerSiklus) : undefined,
      });
      setPreview(result);
      setStep("preview");
    } catch {
      toast.error("Gagal preview jadwal");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await generateMutation({
        officerIds: [...selectedOfficers] as Id<"officers">[],
        shiftId: shiftId as Id<"shifts">,
        siteId: siteId !== "none" ? (siteId as Id<"sites">) : undefined,
        tanggalMulai,
        tanggalSelesai,
        pola,
        siklus: pola === "setiap_hari" ? Number(siklus) : undefined,
        liburPerSiklus: pola === "setiap_hari" ? Number(liburPerSiklus) : undefined,
      });
      toast.success(`${result.created} jadwal berhasil dibuat, ${result.skipped} dilewati`);
      handleClose();
    } catch {
      toast.error("Gagal membuat jadwal");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    onClose();
    setStep("form");
    setPreview(null);
    setSelectedOfficers(new Set());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" />
            Generate Jadwal Otomatis
          </DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tanggal Mulai</Label>
                <Input
                  type="date"
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal Selesai</Label>
                <Input
                  type="date"
                  value={tanggalSelesai}
                  onChange={(e) => setTanggalSelesai(e.target.value)}
                />
              </div>
            </div>

            {/* Shift */}
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <Select value={shiftId} onValueChange={setShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih shift..." />
                </SelectTrigger>
                <SelectContent>
                  {shifts?.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.nama} ({s.jamMulai}–{s.jamSelesai})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Site */}
            <div className="space-y-1.5">
              <Label>Site (opsional)</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa site</SelectItem>
                  {sites?.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pola */}
            <div className="space-y-1.5">
              <Label>Pola Jadwal</Label>
              <Select value={pola} onValueChange={(v) => setPola(v as Pola)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(POLA_LABELS) as Pola[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {POLA_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {pola === "setiap_hari" && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-secondary/30 p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Panjang siklus (hari)</Label>
                  <Input
                    type="number"
                    min={2}
                    max={14}
                    value={siklus}
                    onChange={(e) => setSiklus(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Libur per siklus (hari)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={7}
                    value={liburPerSiklus}
                    onChange={(e) => setLiburPerSiklus(e.target.value)}
                  />
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  Contoh: siklus=4, libur=1 → kerja 3 hari, libur 1 hari, ulangi
                </div>
              </div>
            )}

            {/* Officers multi-select */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Petugas ({selectedOfficers.size} dipilih)</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={toggleAll}>
                  {selectedOfficers.size === (officers?.length ?? 0) ? "Batal semua" : "Pilih semua"}
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border">
                {officers?.map((o) => (
                  <button
                    key={o._id}
                    type="button"
                    onClick={() => toggleOfficer(o._id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
                  >
                    {selectedOfficers.has(o._id) ? (
                      <CheckSquare className="size-4 text-primary shrink-0" />
                    ) : (
                      <Square className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{o.nama}</div>
                      <div className="text-xs text-muted-foreground">{o.jabatan}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Preview step
          <div className="space-y-4">
            <div className="rounded-lg border bg-secondary/30 p-4 space-y-3">
              <h3 className="font-semibold text-sm">Ringkasan Generate Jadwal</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Petugas</div>
                  <div className="font-medium">{selectedOfficers.size} orang</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Pola</div>
                  <div className="font-medium">{POLA_LABELS[pola]}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Rentang</div>
                  <div className="font-medium">{tanggalMulai} s/d {tanggalSelesai}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-green-50 dark:bg-green-900/10 p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{preview?.willCreate}</div>
                <div className="text-xs text-muted-foreground mt-1">Jadwal baru</div>
              </div>
              <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-900/10 p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{preview?.willSkip}</div>
                <div className="text-xs text-muted-foreground mt-1">Dilewati (sudah ada)</div>
              </div>
            </div>
            {preview?.willCreate === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Tidak ada jadwal baru yang akan dibuat. Semua tanggal sudah memiliki jadwal.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "form" ? (
            <>
              <Button variant="ghost" onClick={handleClose}>Batal</Button>
              <Button onClick={handlePreview} disabled={loading}>
                {loading ? "Mengecek..." : "Preview"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("form")}>Kembali</Button>
              <Button
                onClick={handleGenerate}
                disabled={loading || preview?.willCreate === 0}
              >
                {loading ? "Membuat..." : `Buat ${preview?.willCreate} Jadwal`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
