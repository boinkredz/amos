import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { format, addDays, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Users, UserCheck, UserX, Activity } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { cn } from "@/lib/utils.ts";
import MonitoringGroupCard from "./monitoring-group-card.tsx";
import type { MonitoringGroup, MonitoringPersonel } from "./monitoring-group-card.tsx";
import BackupDialog from "./backup-dialog.tsx";
import NotificationToggle from "@/components/notification-toggle.tsx";

const HANDOVER_MS = 30 * 60 * 1000;

/** Current time, refreshed every minute so the handover window stays accurate. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function MonitoringTab() {
  const { canManageOps } = useRole();
  const [tanggal, setTanggal] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const groups = useQuery(api.monitoring.getMonitoring, { tanggal });
  const now = useNow();
  const [editTarget, setEditTarget] = useState<MonitoringGroup | null>(null);
  const [backupTarget, setBackupTarget] = useState<{ g: MonitoringGroup; p: MonitoringPersonel } | null>(null);

  const shiftDate = (n: number) => setTanggal(format(addDays(parseISO(tanggal), n), "yyyy-MM-dd"));

  const totals = (groups ?? []).reduce(
    (acc, g) => ({
      kebutuhan: acc.kebutuhan + g.kebutuhan,
      hadir: acc.hadir + g.hadir,
      kurang: acc.kurang + g.kurang,
      berhalangan: acc.berhalangan + g.personel.filter((p) => p.status === "berhalangan").length,
    }),
    { kebutuhan: 0, hadir: 0, kurang: 0, berhalangan: 0 },
  );

  return (
    <div className="space-y-4">
      <NotificationToggle />
      {/* Date nav */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="icon" className="cursor-pointer shrink-0" onClick={() => shiftDate(-1)} aria-label="Hari sebelumnya">
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex-1 sm:flex-none sm:min-w-56 rounded-md bg-muted px-3 py-2 text-center text-sm font-semibold capitalize">
          {format(parseISO(tanggal), "EEEE, d MMM yyyy", { locale: localeId })}
        </div>
        <Button variant="secondary" size="icon" className="cursor-pointer shrink-0" onClick={() => shiftDate(1)} aria-label="Hari berikutnya">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" className="cursor-pointer hidden sm:inline-flex" onClick={() => setTanggal(format(new Date(), "yyyy-MM-dd"))}>
          Hari ini
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Kebutuhan", value: totals.kebutuhan, icon: Users, cls: "text-foreground" },
          { label: "Sudah check-in", value: totals.hadir, icon: UserCheck, cls: "text-emerald-600 dark:text-emerald-400" },
          { label: "Kekurangan", value: totals.kurang, icon: Activity, cls: totals.kurang ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground" },
          { label: "Berhalangan", value: totals.berhalangan, icon: UserX, cls: "text-amber-600 dark:text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <s.icon className="size-4" /> {s.label}
            </div>
            {groups === undefined ? (
              <Skeleton className="h-8 w-12 mt-2" />
            ) : (
              <div className={cn("text-3xl font-bold tabular-nums mt-1", s.cls)}>{s.value}</div>
            )}
          </div>
        ))}
      </div>

      {groups === undefined ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-2xl" />)}
        </div>
      ) : groups.length === 0 ? (
        <Empty className="border rounded-2xl">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>Belum ada jadwal</EmptyTitle>
            <EmptyDescription>Tidak ada personel yang dijadwalkan di tanggal ini.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <MonitoringGroupCard
              key={g.key}
              group={g}
              handover={now >= g.startMs - HANDOVER_MS && now < g.endMs}
              canManageOps={canManageOps}
              onEditKebutuhan={setEditTarget}
              onBackup={(grp, p) => setBackupTarget({ g: grp, p })}
            />
          ))}
        </div>
      )}

      {editTarget && <KebutuhanDialog group={editTarget} onClose={() => setEditTarget(null)} />}
      {backupTarget && (
        <BackupDialog
          target={{
            _id: backupTarget.p.assignmentId,
            officerNama: backupTarget.p.officerNama,
            shiftLabel: `${backupTarget.g.shiftNama} (${backupTarget.g.jamMulai}–${backupTarget.g.jamSelesai})`,
            tanggal: format(parseISO(tanggal), "d MMM yyyy", { locale: localeId }),
          }}
          onClose={() => setBackupTarget(null)}
        />
      )}
    </div>
  );
}

function KebutuhanDialog({ group, onClose }: { group: MonitoringGroup; onClose: () => void }) {
  const setKebutuhan = useMutation(api.monitoring.setKebutuhan);
  const [jumlah, setJumlah] = useState(String(group.kebutuhan));
  const [saving, setSaving] = useState(false);
  const n = Number(jumlah);
  const valid = Number.isInteger(n) && n >= 1 && n <= 500;

  async function save() {
    setSaving(true);
    try {
      await setKebutuhan({
        siteId: (group.siteId ?? undefined) as Id<"sites"> | undefined,
        shiftId: group.shiftId as Id<"shifts">,
        jumlah: n,
      });
      toast.success("Kebutuhan personel disimpan");
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Kebutuhan Personel</DialogTitle>
          <DialogDescription>
            {group.siteNama} · {group.shiftNama}. Berlaku untuk semua tanggal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="jumlah">Jumlah personel per shift</Label>
          <Input id="jumlah" type="number" min={1} max={500} value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
          {!valid && <p className="text-xs text-destructive">Masukkan angka 1–500</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" className="cursor-pointer" onClick={onClose}>Batal</Button>
          <Button className="cursor-pointer" disabled={!valid || saving} onClick={save}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
