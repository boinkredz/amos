import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";

type Alasan = "sakit" | "izin" | "lainnya";

const ALASAN_OPTIONS: { value: Alasan; label: string }[] = [
  { value: "sakit", label: "Sakit" },
  { value: "izin", label: "Izin" },
  { value: "lainnya", label: "Lainnya" },
];

type Props = {
  target: {
    _id: Id<"shiftAssignments">;
    officerNama: string;
    shiftLabel: string;
    tanggal: string;
  };
  onClose: () => void;
};

export default function BackupDialog({ target, onClose }: Props) {
  const candidates = useQuery(api.backupShift.listCandidates, { assignmentId: target._id });
  const assignBackup = useMutation(api.backupShift.assignBackup);
  const [alasan, setAlasan] = useState<Alasan>("sakit");
  const [backupId, setBackupId] = useState<string>("");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!backupId) {
      toast.error("Pilih personel backup");
      return;
    }
    setLoading(true);
    try {
      await assignBackup({
        assignmentId: target._id,
        backupOfficerId: backupId as Id<"officers">,
        alasan,
        catatan: catatan.trim() || undefined,
      });
      toast.success("Backup berhasil ditugaskan");
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menugaskan backup");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="size-5 text-primary" /> Tugaskan Backup
          </DialogTitle>
          <DialogDescription>
            {target.officerNama} ditandai berhalangan pada {target.shiftLabel}, {target.tanggal}. Backup mengambil alih shift yang sama.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Alasan berhalangan</Label>
            <div className="flex flex-wrap gap-2">
              {ALASAN_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setAlasan(o.value)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    alasan === o.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Personel backup</Label>
            {candidates === undefined ? (
              <Skeleton className="h-9 w-full" />
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                Tidak ada personel yang kosong di tanggal ini.
              </p>
            ) : (
              <Select value={backupId} onValueChange={setBackupId}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Pilih personel..." /></SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.nama} · {c.jabatan}
                      {c.reguNama ? ` · ${c.reguNama}` : ""}
                      {c.sedangLibur ? " (libur)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">Hanya menampilkan personel tanpa jadwal atau yang sedang libur di tanggal ini.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Catatan</Label>
            <Textarea
              rows={2}
              placeholder="Contoh: Demam, ada surat dokter"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="cursor-pointer" onClick={onClose}>Batal</Button>
          <Button className="cursor-pointer" onClick={handleSubmit} disabled={loading || !backupId}>
            {loading ? "Menyimpan..." : "Tugaskan Backup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
