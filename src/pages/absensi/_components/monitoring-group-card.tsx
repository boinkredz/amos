import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { format } from "date-fns";
import { BellRing, Pencil, UserCheck, CheckCircle2, Clock, UserX, AlertTriangle } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { cn } from "@/lib/utils.ts";

export type MonitoringGroup = FunctionReturnType<typeof api.monitoring.getMonitoring>[number];
export type MonitoringPersonel = MonitoringGroup["personel"][number];

const STATUS_UI = {
  hadir: { label: "Hadir", icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  belum: { label: "Belum check-in", icon: Clock, cls: "text-amber-600 dark:text-amber-400" },
  berhalangan: { label: "Berhalangan", icon: UserX, cls: "text-rose-600 dark:text-rose-400" },
} as const;

type Props = {
  group: MonitoringGroup;
  /** Next shift starts within 30 minutes (handover window) or has already started */
  handover: boolean;
  canManageOps: boolean;
  onEditKebutuhan: (g: MonitoringGroup) => void;
  onBackup: (g: MonitoringGroup, p: MonitoringPersonel) => void;
};

export default function MonitoringGroupCard({ group: g, handover, canManageOps, onEditKebutuhan, onBackup }: Props) {
  const kirimPengingat = useMutation(api.monitoring.kirimPengingat);
  const [sending, setSending] = useState(false);
  const belum = g.personel.filter((p) => p.status === "belum");
  const pct = Math.min(100, Math.round((g.hadir / Math.max(1, g.kebutuhan)) * 100));
  const lengkap = g.kurang === 0;

  async function sendReminder(ids: Id<"shiftAssignments">[]) {
    setSending(true);
    try {
      const n = await kirimPengingat({ assignmentIds: ids });
      toast.success(n > 0 ? `Pengingat dikirim ke ${n} personel` : "Semua personel sudah check-in");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal mengirim pengingat");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={cn("rounded-2xl border bg-card p-4 space-y-4", !lengkap && handover && "border-amber-400/60")}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: g.warnaTema ?? "#6B7280" }} />
            <span className="font-semibold truncate">{g.siteNama}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {g.shiftNama} · {g.jamMulai}–{g.jamSelesai}
          </div>
        </div>
        <Badge className={cn("shrink-0 text-xs", lengkap ? "bg-emerald-600 text-white" : "bg-rose-600 text-white")}>
          {lengkap ? "Lengkap" : `Kurang ${g.kurang}`}
        </Badge>
      </div>

      {/* Headcount */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Butuh", value: g.kebutuhan, cls: "text-foreground" },
            { label: "Hadir", value: g.hadir, cls: "text-emerald-600 dark:text-emerald-400" },
            { label: "Kurang", value: g.kurang, cls: g.kurang ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-muted/50 py-2">
              <div className={cn("text-2xl font-bold tabular-nums leading-none", s.cls)}>{s.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Terjadwal {g.terjadwal} dari kebutuhan {g.kebutuhan}</span>
          {canManageOps && (
            <button
              type="button"
              onClick={() => onEditKebutuhan(g)}
              className="cursor-pointer inline-flex items-center gap-1 hover:text-foreground"
            >
              <Pencil className="size-3" /> Ubah kebutuhan
            </button>
          )}
        </div>
        {g.terjadwal < g.kebutuhan && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            Jadwal kurang {g.kebutuhan - g.terjadwal} orang. Atur backup atau tambah jadwal.
          </div>
        )}
      </div>

      {/* Handover reminder */}
      {handover && belum.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-semibold">Pergantian shift:</span> {belum.length} personel belum check-in.
          </p>
          <Button
            size="sm"
            className="cursor-pointer h-8 bg-amber-500 hover:bg-amber-600 text-white"
            disabled={sending}
            onClick={() => sendReminder(belum.map((p) => p.assignmentId))}
          >
            <BellRing className="size-3.5" /> {sending ? "Mengirim..." : "Kirim Pengingat"}
          </Button>
        </div>
      )}

      {/* Personnel list */}
      <ul className="divide-y">
        {g.personel.map((p) => {
          const ui = STATUS_UI[p.status];
          const Icon = ui.icon;
          return (
            <li key={p.assignmentId} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className={cn("text-sm font-medium truncate", p.status === "berhalangan" && "line-through text-muted-foreground")}>
                  {p.officerNama}
                  {p.isBackup && <Badge className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0">Backup</Badge>}
                </div>
                <div className={cn("flex items-center gap-1 text-[11px]", ui.cls)}>
                  <Icon className="size-3" />
                  {p.status === "hadir" && p.waktuMasuk
                    ? `Masuk ${format(new Date(p.waktuMasuk), "HH:mm")}${p.isLate ? " · Terlambat" : ""}`
                    : ui.label}
                  {p.status === "belum" && p.pengingatWaktu && (
                    <span className="text-muted-foreground">· diingatkan {format(new Date(p.pengingatWaktu), "HH:mm")}</span>
                  )}
                </div>
              </div>
              {p.status === "belum" && (
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer h-7 px-2 text-xs"
                    disabled={sending}
                    onClick={() => sendReminder([p.assignmentId])}
                    aria-label={`Ingatkan ${p.officerNama}`}
                  >
                    <BellRing className="size-3.5" />
                  </Button>
                  {canManageOps && !p.isBackup && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                      onClick={() => onBackup(g, p)}
                    >
                      <UserCheck className="size-3.5" /> Backup
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
