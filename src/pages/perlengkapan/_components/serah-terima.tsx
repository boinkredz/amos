import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

type Kondisi = "baik" | "rusak" | "hilang";

const KONDISI_LABELS: Record<Kondisi, string> = {
  baik: "Baik",
  rusak: "Rusak",
  hilang: "Hilang",
};

const KONDISI_COLORS: Record<Kondisi, string> = {
  baik: "text-green-600",
  rusak: "text-yellow-600",
  hilang: "text-red-600",
};

const STATUS_CONFIG = {
  menunggu: { label: "Menunggu Konfirmasi", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Clock },
  selesai: { label: "Selesai", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  ada_masalah: { label: "Ada Masalah", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: AlertTriangle },
};

export default function SerahTerima() {
  const myAssignment = useQuery(api.perlengkapan.getMyTodayAssignment, {});
  const sites = useQuery(api.sites.list, {});
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const menugggu = useQuery(api.perlengkapan.listSerahTerimaMenunggu, {});
  const riwayat = useQuery(
    api.perlengkapan.listSerahTerimaBySite,
    selectedSiteId ? { siteId: selectedSiteId as Id<"sites"> } : "skip",
  );

  const alat = useQuery(
    api.perlengkapan.listMaster,
    myAssignment?.siteId ? { siteId: myAssignment.siteId as Id<"sites"> } : "skip",
  );
  const submitSerahMutation = useMutation(api.perlengkapan.submitSerahTerima);
  const konfirmasiMutation = useMutation(api.perlengkapan.konfirmasiSerahTerima);

  const [showSerahForm, setShowSerahForm] = useState(false);
  const [konfirmasiItem, setKonfirmasiItem] = useState<string | null>(null);
  const [serahItems, setSerahItems] = useState<Record<string, { kondisi: Kondisi; jumlahTersedia: string; keterangan: string }>>({});
  const [catatanKejadian, setCatatanKejadian] = useState("");
  const [catatanMasuk, setCatatanMasuk] = useState("");
  const [adaMasalah, setAdaMasalah] = useState(false);
  const [loading, setLoading] = useState(false);

  function getSerahItem(id: string) {
    return serahItems[id] ?? { kondisi: "baik" as Kondisi, jumlahTersedia: "1", keterangan: "" };
  }

  async function handleSubmitSerah() {
    if (!myAssignment?.siteId) return;
    const activeAlat = alat?.filter((a) => a.aktif) ?? [];
    setLoading(true);
    try {
      await submitSerahMutation({
        siteId: myAssignment.siteId as Id<"sites">,
        tanggal: myAssignment.tanggal,
        shiftKeluarAssignmentId: myAssignment.assignmentId as Id<"shiftAssignments">,
        cekPerlengkapan: activeAlat.map((a) => {
          const item = getSerahItem(a._id);
          return {
            perlengkapanId: a._id,
            kondisi: item.kondisi,
            jumlahTersedia: Number(item.jumlahTersedia) || 0,
            keterangan: item.keterangan || undefined,
          };
        }),
        catatanKejadian,
      });
      toast.success("Serah terima berhasil dikirim");
      setShowSerahForm(false);
    } catch {
      toast.error("Gagal mengirim serah terima");
    } finally {
      setLoading(false);
    }
  }

  async function handleKonfirmasi() {
    if (!konfirmasiItem || !myAssignment) return;
    setLoading(true);
    try {
      await konfirmasiMutation({
        id: konfirmasiItem as Id<"serahTerima">,
        shiftMasukAssignmentId: myAssignment.assignmentId as Id<"shiftAssignments">,
        catatanMasuk: catatanMasuk || undefined,
        adaMasalah,
      });
      toast.success("Serah terima berhasil dikonfirmasi");
      setKonfirmasiItem(null);
    } catch {
      toast.error("Gagal konfirmasi serah terima");
    } finally {
      setLoading(false);
    }
  }

  const pendingKonfirmasi = menugggu ?? [];

  return (
    <div className="space-y-6">
      {/* Pending konfirmasi banner */}
      {pendingKonfirmasi.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800/50 dark:bg-yellow-900/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4 text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              {pendingKonfirmasi.length} Serah Terima Menunggu Konfirmasi
            </span>
          </div>
          <div className="space-y-2">
            {pendingKonfirmasi.map((st) => (
              <div key={st._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md bg-white dark:bg-background/50 px-3 py-3 text-sm border">
                <div>
                  <span className="font-medium">{st.siteNama}</span>
                  <span className="mx-1.5 text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{st.shiftKeluarNama} ({st.officerKeluarNama})</span>
                </div>
                <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => { setKonfirmasiItem(st._id); setCatatanMasuk(""); setAdaMasalah(false); }}>
                  Konfirmasi
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shift saya - submit serah terima */}
      {myAssignment?.siteId && (
        <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="font-medium">Serah Terima Shift Saya</div>
            <div className="text-sm text-muted-foreground">{myAssignment.shiftNama} • {format(new Date(myAssignment.tanggal), "d MMMM yyyy", { locale: idLocale })}</div>
          </div>
          <Button size="sm" className="w-full sm:w-auto" onClick={() => setShowSerahForm(true)}>
            <ArrowRight className="mr-1 size-4" />
            Serahkan
          </Button>
        </div>
        </div>
      )}

      {/* Riwayat per site */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Label className="shrink-0 text-sm">Riwayat Site:</Label>
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Pilih site..." />
            </SelectTrigger>
            <SelectContent>
              {sites?.map((s) => (
                <SelectItem key={s._id} value={s._id}>{s.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedSiteId && riwayat === undefined && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {selectedSiteId && riwayat?.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><ArrowLeftRight /></EmptyMedia>
              <EmptyTitle>Belum ada riwayat</EmptyTitle>
              <EmptyDescription>Belum ada serah terima untuk site ini</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {riwayat && riwayat.length > 0 && (
          <div className="space-y-2">
            {riwayat.map((st) => {
              const statusCfg = STATUS_CONFIG[st.status as keyof typeof STATUS_CONFIG];
              const StatusIcon = statusCfg.icon;
              return (
                <div key={st._id} className={`rounded-xl border-l-4 border border-border bg-card px-4 py-3 shadow-sm ${
                  st.status === "selesai" ? "border-l-green-500" : st.status === "ada_masalah" ? "border-l-destructive" : "border-l-amber-400"
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-semibold text-foreground">{st.tanggal}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                        <span>{st.shiftKeluarNama} ({st.officerKeluarNama ?? "—"})</span>
                        <ArrowLeftRight className="size-3" />
                        <span>{st.officerMasukNama ?? "Menunggu"}</span>
                      </div>
                      {st.catatanKejadian && (
                        <p className="mt-1 text-[11px] text-muted-foreground font-normal line-clamp-1">{st.catatanKejadian}</p>
                      )}
                    </div>
                    <StatusIcon className="size-4 mt-0.5 shrink-0 opacity-70" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Serah Terima */}
      <Dialog open={showSerahForm} onOpenChange={setShowSerahForm}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Serah Terima Perlengkapan</DialogTitle>
          </DialogHeader>
          {alat === undefined ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {alat.filter((a) => a.aktif).map((a) => {
                  const item = getSerahItem(a._id);
                  return (
                    <div key={a._id} className="rounded-lg border p-3 space-y-2">
                      <div className="font-medium text-sm">{a.nama}</div>
                      <div className="flex gap-1.5">
                        {(["baik", "rusak", "hilang"] as Kondisi[]).map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() =>
                              setSerahItems((prev) => ({
                                ...prev,
                                [a._id]: { ...getSerahItem(a._id), kondisi: k },
                              }))
                            }
                            className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                              item.kondisi === k
                                ? k === "baik"
                                  ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                  : k === "rusak"
                                    ? "border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                                    : "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                : "border-border bg-background hover:bg-secondary"
                            }`}
                          >
                            {KONDISI_LABELS[k]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label>Catatan Kejadian</Label>
                <Textarea
                  placeholder="Catatan kejadian atau informasi untuk shift berikutnya..."
                  rows={3}
                  value={catatanKejadian}
                  onChange={(e) => setCatatanKejadian(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSerahForm(false)}>Batal</Button>
            <Button onClick={handleSubmitSerah} disabled={loading}>
              {loading ? "Mengirim..." : "Serahkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Dialog */}
      <Dialog open={!!konfirmasiItem} onOpenChange={(o) => !o && setKonfirmasiItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Serah Terima</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {konfirmasiItem && (
              <SerahTerimaDetail id={konfirmasiItem as Id<"serahTerima">} />
            )}
            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Textarea
                placeholder="Catatan jika ada perbedaan kondisi..."
                rows={2}
                value={catatanMasuk}
                onChange={(e) => setCatatanMasuk(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ada-masalah"
                checked={adaMasalah}
                onChange={(e) => setAdaMasalah(e.target.checked)}
                className="cursor-pointer"
              />
              <label htmlFor="ada-masalah" className="text-sm cursor-pointer">
                Tandai ada masalah
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKonfirmasiItem(null)}>Batal</Button>
            <Button onClick={handleKonfirmasi} disabled={loading}>
              {loading ? "Mengkonfirmasi..." : "Konfirmasi Terima"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SerahTerimaDetail({ id }: { id: Id<"serahTerima"> }) {
  const alat = useQuery(api.perlengkapan.listMaster, {});

  // We fetch all sites' riwayat but only show this one
  // For now just show a placeholder — the data is shown in parent
  return (
    <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
      Periksa daftar perlengkapan dari shift sebelumnya sebelum konfirmasi.
    </div>
  );
}
