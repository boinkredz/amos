import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { toast } from "sonner";
import { ArrowLeftRight, CheckCircle2, XCircle, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
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
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useRole } from "@/hooks/use-role.ts";
import { ConvexError } from "convex/values";
import KeputusanInfo from "@/components/keputusan-info.tsx";

type SwapStatus = "pending" | "approved" | "rejected";

const STATUS_CONFIG: Record<SwapStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Menunggu", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Clock },
  approved: { label: "Disetujui", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  rejected: { label: "Ditolak", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
};

export default function TukarShiftTab() {
  const { canManageOps } = useRole();
  const access = useQuery(api.approval.getMyApproverAccess, {});
  const canApprove = !!access?.tukar_shift;
  const allSwaps = useQuery(api.shifts.listSwapRequests, canManageOps ? {} : "skip");
  const mySwaps = useQuery(api.shifts.getMySwapRequests, !canManageOps ? {} : "skip");
  const swaps = canManageOps ? allSwaps : mySwaps;

  const approveMutation = useMutation(api.shifts.approveShiftSwap);
  const rejectMutation = useMutation(api.shifts.rejectShiftSwap);

  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const errMsg = (err: unknown, fallback: string) =>
    err instanceof ConvexError ? (err.data as { message: string }).message : fallback;

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      await approveMutation({ swapId: id as Id<"shiftSwapRequests"> });
      toast.success("Tukar shift disetujui");
    } catch (err) {
      toast.error(errMsg(err, "Gagal menyetujui"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: string) {
    setActionLoading(id + "_reject");
    try {
      await rejectMutation({ swapId: id as Id<"shiftSwapRequests"> });
      toast.success("Tukar shift ditolak");
    } catch (err) {
      toast.error(errMsg(err, "Gagal menolak"));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {canManageOps ? "Semua Permintaan Tukar Shift" : "Permintaan Tukar Shift Saya"}
        </h3>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 size-4" />
          Ajukan Tukar Shift
        </Button>
      </div>

      {swaps === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : swaps.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ArrowLeftRight /></EmptyMedia>
            <EmptyTitle>Belum ada permintaan</EmptyTitle>
            <EmptyDescription>Permintaan tukar shift akan muncul di sini</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {swaps.map((s) => {
            const cfg = STATUS_CONFIG[s.status as SwapStatus];
            const StatusIcon = cfg.icon;
            return (
              <div key={s._id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.requesterNama}</span>
                      <ArrowLeftRight className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{s.targetNama}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{s.requesterTanggal} ({s.requesterShiftNama})</span>
                      <span>↔</span>
                      <span>{s.targetTanggal} ({s.targetShiftNama})</span>
                    </div>
                    {s.alasan && (
                      <p className="text-xs text-muted-foreground">Alasan: {s.alasan}</p>
                    )}
                    <KeputusanInfo keputusan={s.keputusan} />
                  </div>
                  <StatusIcon className="size-4 mt-0.5 shrink-0 opacity-70" />
                </div>
                {canApprove && s.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(s._id)}
                      disabled={actionLoading === s._id}
                    >
                      {actionLoading === s._id ? "..." : "Setujui"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleReject(s._id)}
                      disabled={actionLoading === s._id + "_reject"}
                    >
                      {actionLoading === s._id + "_reject" ? "..." : "Tolak"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SwapRequestForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}

function SwapRequestForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const officers = useQuery(api.officers.list, { status: "aktif" });
  const requestMutation = useMutation(api.shifts.requestShiftSwap);

  const today = format(new Date(), "yyyy-MM-dd");
  const thirtyDaysLater = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

  const [myAssignmentId, setMyAssignmentId] = useState("");
  const [targetOfficerId, setTargetOfficerId] = useState("");
  const [targetAssignmentId, setTargetAssignmentId] = useState("");
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);

  // My officer record
  const myOfficer = useQuery(api.officers.getMyOfficer, {});
  const myAssignments = useQuery(
    api.shifts.listOfficerAssignments,
    myOfficer
      ? { officerId: myOfficer._id, tanggalMulai: today, tanggalSelesai: thirtyDaysLater }
      : "skip",
  );
  const targetAssignments = useQuery(
    api.shifts.listOfficerAssignments,
    targetOfficerId
      ? { officerId: targetOfficerId as Id<"officers">, tanggalMulai: today, tanggalSelesai: thirtyDaysLater }
      : "skip",
  );

  async function handleSubmit() {
    if (!myAssignmentId || !targetAssignmentId) {
      toast.error("Pilih jadwal yang ingin ditukar");
      return;
    }
    setLoading(true);
    try {
      await requestMutation({
        requesterAssignmentId: myAssignmentId as Id<"shiftAssignments">,
        targetAssignmentId: targetAssignmentId as Id<"shiftAssignments">,
        alasan: alasan || undefined,
      });
      toast.success("Permintaan tukar shift berhasil diajukan");
      onClose();
    } catch (err) {
      const msg = err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal mengajukan tukar shift";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajukan Tukar Shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Jadwal saya yang ingin ditukar</Label>
            <Select value={myAssignmentId} onValueChange={setMyAssignmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih jadwal saya..." />
              </SelectTrigger>
              <SelectContent>
                {myAssignments?.map((a) => (
                  <SelectItem key={a._id} value={a._id}>
                    {a.tanggal} — {a.shiftNama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Petugas tujuan</Label>
            <Select value={targetOfficerId} onValueChange={(v) => { setTargetOfficerId(v); setTargetAssignmentId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih petugas..." />
              </SelectTrigger>
              <SelectContent>
                {officers
                  ?.filter((o) => o._id !== myOfficer?._id)
                  .map((o) => (
                    <SelectItem key={o._id} value={o._id}>
                      {o.nama}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {targetOfficerId && (
            <div className="space-y-1.5">
              <Label>Jadwal petugas tujuan</Label>
              <Select value={targetAssignmentId} onValueChange={setTargetAssignmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jadwal tujuan..." />
                </SelectTrigger>
                <SelectContent>
                  {targetAssignments?.map((a) => (
                    <SelectItem key={a._id} value={a._id}>
                      {a.tanggal} — {a.shiftNama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Alasan (opsional)</Label>
            <Textarea
              placeholder="Jelaskan alasan tukar shift..."
              rows={2}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Mengajukan..." : "Ajukan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
