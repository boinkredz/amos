import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Bot, ShieldCheck, UserCheck, UserCog } from "lucide-react";

export type Keputusan = {
  keputusan: "pending" | "approved" | "rejected";
  sebagai: "utama" | "cadangan" | "admin" | "otomatis" | null;
  waktu: string | null;
  aturan: string | null;
  olehNama: string | null;
  olehPeran: string | null;
} | null;

const SEBAGAI_LABEL = {
  utama: "Approver utama",
  cadangan: "Approver cadangan",
  admin: "Super Admin",
  otomatis: "Otomatis",
} as const;

/** One-line "Disetujui/Ditolak oleh ..." shown under a request. */
export default function KeputusanInfo({ keputusan }: { keputusan: Keputusan }) {
  if (!keputusan) return null;
  const verb = keputusan.keputusan === "rejected" ? "Ditolak" : "Disetujui";
  const waktu = keputusan.waktu ? format(new Date(keputusan.waktu), "d MMM yyyy, HH:mm", { locale: idLocale }) : null;
  const Icon = keputusan.sebagai === "otomatis" ? Bot : keputusan.sebagai === "cadangan" ? UserCog : keputusan.sebagai === "admin" ? ShieldCheck : UserCheck;

  const siapa = keputusan.sebagai === "otomatis"
    ? `otomatis${keputusan.aturan ? ` · ${keputusan.aturan}` : ""}`
    : `oleh ${keputusan.olehNama ?? "—"}${keputusan.olehPeran ? ` (${keputusan.olehPeran})` : ""}`;

  return (
    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <span className="font-medium text-foreground">{verb}</span> {siapa}
        {keputusan.sebagai && keputusan.sebagai !== "otomatis" && ` · ${SEBAGAI_LABEL[keputusan.sebagai]}`}
        {waktu && ` · ${waktu}`}
      </span>
    </div>
  );
}
