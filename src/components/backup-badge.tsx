import { UserX, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

export type BackupFields = {
  berhalangan?: { alasan: "sakit" | "izin" | "lainnya"; catatan?: string } | null;
  backupInfo?: object | null;
  linkedOfficerNama?: string | null;
};

const ALASAN_LABEL = { sakit: "Sakit", izin: "Izin", lainnya: "Lainnya" } as const;

/** "Berhalangan" / "Backup" badge with the linked officer's name. */
export default function BackupBadge({ row, className }: { row: BackupFields; className?: string }) {
  if (row.berhalangan) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1 text-[11px]", className)}>
        <Badge className="bg-rose-600 text-white text-[10px] px-1.5 py-0 gap-1">
          <UserX className="size-3" /> Berhalangan · {ALASAN_LABEL[row.berhalangan.alasan]}
        </Badge>
        {row.linkedOfficerNama && (
          <span className="text-muted-foreground">Diganti {row.linkedOfficerNama}</span>
        )}
      </div>
    );
  }
  if (row.backupInfo) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1 text-[11px]", className)}>
        <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 gap-1">
          <UserCheck className="size-3" /> Backup
        </Badge>
        {row.linkedOfficerNama && (
          <span className="text-muted-foreground">Menggantikan {row.linkedOfficerNama}</span>
        )}
      </div>
    );
  }
  return null;
}
