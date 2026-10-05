import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Plane,
  HeartPulse,
  Upload,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useRole } from "@/hooks/use-role.ts";
import { ConvexError } from "convex/values";
import KeputusanInfo from "@/components/keputusan-info.tsx";

type ReqStatus = "pending" | "approved" | "rejected";

const STATUS_CONFIG: Record<
  ReqStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: "Menunggu",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    icon: Clock,
  },
  approved: {
    label: "Disetujui",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Ditolak",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: XCircle,
  },
};

export default function CutiIzinTab() {
  const { canManageOps, canManagePersonnel } = useRole();
  const isManager = canManageOps || canManagePersonnel;
  const access = useQuery(api.approval.getMyApproverAccess, {});
  const canApprove = !!access?.cuti;

  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState("pending");

  const allRequests = useQuery(
    api.cuti.listCutiRequests,
    isManager ? { status: tab as ReqStatus } : "skip",
  );
  const myRequests = useQuery(api.cuti.getMyCutiRequests, !isManager ? {} : "skip");
  const myBalance = useQuery(api.cuti.getMyCutiBalance, {});

  const approveMutation = useMutation(api.cuti.approveCuti);
  const rejectMutation = useMutation(api.cuti.rejectCuti);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [catatanDialog, setCatatanDialog] = useState<{
    id: string;
    type: "approve" | "reject";
  } | null>(null);
  const [catatanText, setCatatanText] = useState("");

  async function handleAction() {
    if (!catatanDialog) return;
    setActionLoading(catatanDialog.id);
    try {
      if (catatanDialog.type === "approve") {
        await approveMutation({
          cutiId: catatanDialog.id as Id<"cutiRequests">,
          catatan: catatanText || undefined,
        });
        toast.success("Pengajuan disetujui");
      } else {
        await rejectMutation({
          cutiId: catatanDialog.id as Id<"cutiRequests">,
          catatan: catatanText || undefined,
        });
        toast.success("Pengajuan ditolak");
      }
      setCatatanDialog(null);
      setCatatanText("");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal memproses pengajuan");
    } finally {
      setActionLoading(null);
    }
  }

  const requests = isManager ? allRequests : myRequests;

  return (
    <div className="space-y-4">
      {/* Balance card for non-managers */}
      {myBalance && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold">{myBalance.jatahTotal}</div>
            <div className="text-xs text-muted-foreground">Jatah Total</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{myBalance.terpakai}</div>
            <div className="text-xs text-muted-foreground">Terpakai</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{myBalance.sisa}</div>
            <div className="text-xs text-muted-foreground">Sisa Cuti</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {isManager ? "Pengajuan Cuti & Sakit" : "Pengajuan Saya"}
        </h3>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 size-4" />
          Ajukan Cuti / Sakit
        </Button>
      </div>

      {isManager && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">Menunggu</TabsTrigger>
            <TabsTrigger value="approved">Disetujui</TabsTrigger>
            <TabsTrigger value="rejected">Ditolak</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {requests === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Plane /></EmptyMedia>
            <EmptyTitle>Tidak ada pengajuan</EmptyTitle>
            <EmptyDescription>
              {isManager ? "Belum ada pengajuan cuti atau sakit" : "Anda belum pernah mengajukan cuti atau sakit"}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setShowForm(true)}>Ajukan Sekarang</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const cfg = STATUS_CONFIG[r.status as ReqStatus];
            const StatusIcon = cfg.icon;
            const days =
              Math.round(
                (new Date(r.tanggalSelesai + "T12:00:00Z").getTime() -
                  new Date(r.tanggalMulai + "T12:00:00Z").getTime()) /
                  (1000 * 60 * 60 * 24),
              ) + 1;

            return (
              <div key={r._id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.jenis === "cuti" ? (
                        <Plane className="size-4 text-blue-500 shrink-0" />
                      ) : (
                        <HeartPulse className="size-4 text-red-500 shrink-0" />
                      )}
                      <span className="font-medium text-sm">
                        {r.jenis === "cuti" ? "Cuti" : "Sakit"}{" "}
                        {r.officerNama && <span>— {r.officerNama}</span>}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {days} hari
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.tanggalMulai} s/d {r.tanggalSelesai}
                    </div>
                    <p className="text-xs text-muted-foreground">{r.alasan}</p>
                    {r.catatan && (
                      <p className="text-xs text-primary">Catatan: {r.catatan}</p>
                    )}
                    <KeputusanInfo keputusan={r.keputusan} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.suratSakitUrl && (
                      <a
                        href={r.suratSakitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline"
                      >
                        Surat Sakit
                      </a>
                    )}
                    <StatusIcon className="size-4 opacity-70" />
                  </div>
                </div>
                {canApprove && r.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        setCatatanDialog({ id: r._id, type: "approve" });
                        setCatatanText("");
                      }}
                    >
                      Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setCatatanDialog({ id: r._id, type: "reject" });
                        setCatatanText("");
                      }}
                    >
                      Tolak
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Catatan dialog */}
      <Dialog
        open={!!catatanDialog}
        onOpenChange={(o) => !o && setCatatanDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {catatanDialog?.type === "approve" ? "Setujui Pengajuan" : "Tolak Pengajuan"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Textarea
              placeholder="Tambahkan catatan untuk petugas..."
              rows={3}
              value={catatanText}
              onChange={(e) => setCatatanText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCatatanDialog(null)}>
              Batal
            </Button>
            <Button
              onClick={handleAction}
              disabled={!!actionLoading}
              variant={catatanDialog?.type === "reject" ? "destructive" : "default"}
            >
              {actionLoading
                ? "Memproses..."
                : catatanDialog?.type === "approve"
                  ? "Setujui"
                  : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CutiRequestForm open={showForm} onClose={() => setShowForm(false)} isManager={isManager} />
    </div>
  );
}

function CutiRequestForm({
  open,
  onClose,
  isManager,
}: {
  open: boolean;
  onClose: () => void;
  isManager: boolean;
}) {
  const officers = useQuery(api.officers.list, { status: "aktif" });
  const requestMutation = useMutation(api.cuti.requestCuti);
  const requestForMutation = useMutation(api.cuti.requestCutiForOfficer);
  const generateUploadUrl = useMutation(api.cuti.generateUploadUrl);

  const today = format(new Date(), "yyyy-MM-dd");
  const [jenis, setJenis] = useState<"cuti" | "sakit">("cuti");
  const [officerId, setOfficerId] = useState("self");
  const [tanggalMulai, setTanggalMulai] = useState(today);
  const [tanggalSelesai, setTanggalSelesai] = useState(today);
  const [alasan, setAlasan] = useState("");
  const [suratFile, setSuratFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (!alasan) {
      toast.error("Alasan wajib diisi");
      return;
    }
    if (jenis === "sakit" && !suratFile && !isManager) {
      toast.error("Surat sakit wajib diupload");
      return;
    }
    setLoading(true);
    try {
      let suratSakitId: string | undefined;
      if (suratFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": suratFile.type },
          body: suratFile,
        });
        const { storageId } = await res.json() as { storageId: string };
        suratSakitId = storageId;
      }

      if (isManager && officerId !== "self") {
        await requestForMutation({
          officerId: officerId as Id<"officers">,
          jenis,
          tanggalMulai,
          tanggalSelesai,
          alasan,
          suratSakit: suratSakitId,
        });
      } else {
        await requestMutation({
          jenis,
          tanggalMulai,
          tanggalSelesai,
          alasan,
          suratSakit: suratSakitId,
        });
      }

      toast.success("Pengajuan berhasil dikirim");
      onClose();
      setAlasan("");
      setSuratFile(null);
      setJenis("cuti");
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Gagal mengajukan";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajukan Cuti / Izin Sakit</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isManager && (
            <div className="space-y-1.5">
              <Label>Petugas</Label>
              <Select value={officerId} onValueChange={setOfficerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Diri sendiri</SelectItem>
                  {officers?.map((o) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Jenis</Label>
            <div className="flex gap-2">
              {(["cuti", "sakit"] as const).map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJenis(j)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    jenis === j
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  {j === "cuti" ? (
                    <Plane className="size-4" />
                  ) : (
                    <HeartPulse className="size-4" />
                  )}
                  {j === "cuti" ? "Cuti" : "Sakit"}
                </button>
              ))}
            </div>
          </div>

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
                min={tanggalMulai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Alasan</Label>
            <Textarea
              placeholder="Jelaskan alasan..."
              rows={3}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
          </div>

          {jenis === "sakit" && (
            <div className="space-y-1.5">
              <Label>Surat Sakit {!isManager && <span className="text-destructive">*</span>}</Label>
              <div
                className="flex items-center gap-3 rounded-lg border border-dashed p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {suratFile ? suratFile.name : "Klik untuk upload foto/scan surat sakit"}
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setSuratFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Mengirim..." : "Kirim Pengajuan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
