import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
  Plane,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { useRole } from "@/hooks/use-role.ts";
import { cn } from "@/lib/utils.ts";

// ── Stat Card ─────────────────────────────────────────────────────────────────
type Tone = "default" | "accent" | "danger" | "warning";
const TONE_ICON: Record<Tone, string> = {
  default: "bg-secondary text-secondary-foreground",
  accent: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-destructive",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string | undefined;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 flex items-center gap-3 shadow-sm">
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_ICON[tone])}>
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-muted-foreground leading-tight">{label}</div>
        {value === undefined
          ? <Skeleton className="h-7 w-10 mt-1" />
          : <div className="text-[26px] font-bold leading-snug tracking-tight">{value}</div>}
      </div>
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  linkTo,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  linkTo: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2 font-semibold text-[13px] text-foreground">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      <Link
        to={linkTo}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Lihat Semua <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

function EmptyFeed({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
      Belum ada {label}
    </div>
  );
}

// ── Feed Item — border kiri berwarna ─────────────────────────────────────────
function FeedItem({
  left,
  right,
  sub,
  badge,
  badgeVariant = "secondary",
  borderColor = "border-l-border",
}: {
  left: string;
  right?: string;
  sub?: string;
  badge?: string;
  badgeVariant?: "secondary" | "destructive" | "default" | "outline";
  borderColor?: string;
}) {
  return (
    <div className={cn(
      "flex items-start justify-between gap-2 rounded-xl border-l-4 border border-border bg-card px-3.5 py-3 shadow-sm",
      borderColor
    )}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-foreground leading-snug">{left}</div>
        {sub && <div className="truncate text-[11px] text-muted-foreground mt-0.5 font-normal">{sub}</div>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
        {right && <span className="text-[11px] text-muted-foreground font-medium">{right}</span>}
        {badge && (
          <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0 font-semibold">{badge}</Badge>
        )}
      </div>
    </div>
  );
}

// ── Feeds ──────────────────────────────────────────────────────────────────────
function LaporanHarianFeed() {
  const data = useQuery(api.dashboard.recentLaporanHarian, {});
  if (data === undefined) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (data.length === 0) return <EmptyFeed label="laporan harian" />;
  return (
    <div className="space-y-2">
      {data.map((r) => (
        <FeedItem
          key={r._id}
          left={r.lokasiGedung}
          sub={`${r.petugasNama}${r.siteNama ? ` • ${r.siteNama}` : ""}`}
          right={format(new Date(r.tanggal + "T12:00:00"), "d MMM", { locale: idLocale })}
          borderColor="border-l-blue-400"
        />
      ))}
    </div>
  );
}

const JENIS_INSIDEN_LABELS: Record<string, string> = {
  kehilangan: "Kehilangan",
  kecelakaan: "Kecelakaan",
  kebakaran: "Kebakaran",
  tindak_kriminal: "Kriminal",
  pelanggaran: "Pelanggaran",
  lainnya: "Lainnya",
};

function BeritaAcaraFeed() {
  const data = useQuery(api.dashboard.recentBeritaAcara, {});
  if (data === undefined) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (data.length === 0) return <EmptyFeed label="berita acara" />;
  return (
    <div className="space-y-2">
      {data.map((r) => (
        <FeedItem
          key={r._id}
          left={`${r.nomorBA} — ${r.lokasiGedung}`}
          sub={`${JENIS_INSIDEN_LABELS[r.jenisInsiden] ?? r.jenisInsiden} • ${r.petugasNama}`}
          right={format(new Date(r.tanggal + "T12:00:00"), "d MMM", { locale: idLocale })}
          badge={JENIS_INSIDEN_LABELS[r.jenisInsiden] ?? r.jenisInsiden}
          badgeVariant="destructive"
          borderColor="border-l-destructive"
        />
      ))}
    </div>
  );
}

function PatroliFeed() {
  const data = useQuery(api.dashboard.recentPatroli, {});
  if (data === undefined) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (data.length === 0) return <EmptyFeed label="laporan patroli" />;
  return (
    <div className="space-y-2">
      {data.map((r) => (
        <FeedItem
          key={r._id}
          left={r.ruteNama ?? "Rute tidak diketahui"}
          sub={r.officerNama ?? "—"}
          right={format(new Date(r.tanggal + "T12:00:00"), "d MMM", { locale: idLocale })}
          badge={r.status}
          badgeVariant={r.selesai ? "secondary" : "default"}
          borderColor={r.selesai ? "border-l-green-500" : "border-l-primary"}
        />
      ))}
    </div>
  );
}

const SERAH_STATUS: Record<string, { label: string; variant: "secondary" | "default" | "destructive"; border: string }> = {
  menunggu: { label: "Menunggu", variant: "default", border: "border-l-amber-400" },
  selesai: { label: "Selesai", variant: "secondary", border: "border-l-green-500" },
  batal: { label: "Batal", variant: "destructive", border: "border-l-destructive" },
};

function SerahTerimaFeed() {
  const data = useQuery(api.dashboard.recentSerahTerima, {});
  if (data === undefined) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (data.length === 0) return <EmptyFeed label="serah terima shift" />;
  return (
    <div className="space-y-2">
      {data.map((r) => {
        const s = SERAH_STATUS[r.status] ?? { label: r.status, variant: "secondary" as const, border: "border-l-border" };
        return (
          <FeedItem
            key={r._id}
            left={r.siteNama ?? "Lokasi tidak diketahui"}
            sub={[r.officerKeluarNama, r.officerMasukNama].filter(Boolean).join(" → ") || "—"}
            right={format(new Date(r.tanggal + "T12:00:00"), "d MMM", { locale: idLocale })}
            badge={s.label}
            badgeVariant={s.variant}
            borderColor={s.border}
          />
        );
      })}
    </div>
  );
}

// ── Quick Actions (mobile only) ────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "Jadwal", icon: CalendarDays, to: "/absensi" },
  { label: "Patroli", icon: ShieldCheck, to: "/patroli" },
  { label: "Insiden", icon: AlertTriangle, to: "/insiden" },
  { label: "Perlengkapan", icon: Package, to: "/perlengkapan" },
];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Index() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const officerStats = useQuery(api.officers.stats, {});

  const firstName = user?.profile.name?.split(" ")[0] ?? "Petugas";
  const today = format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale });

  return (
    <div className="space-y-6">
      {/* ── Greeting card (mobile-first) ── */}
      <div className="rounded-xl bg-primary text-primary-foreground px-5 py-4 space-y-0.5 shadow-md">
        <div className="text-[17px] font-bold leading-snug">Selamat datang, {firstName} 👋</div>
        <div className="text-[12px] text-primary-foreground/75 capitalize font-normal">{today}</div>
        {isAdmin && (
          <div className="pt-2.5">
            <Link
              to="/pengaturan/peran"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 text-primary-foreground text-[11px] font-semibold px-3 py-1.5 transition-colors"
            >
              Kelola Peran <ArrowRight className="size-3" />
            </Link>
          </div>
        )}
      </div>

      {/* ── Quick actions (mobile only) ── */}
      <div className="grid grid-cols-4 gap-2 md:hidden">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-muted p-3 text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
          >
            <a.icon className="size-5" />
            <span className="text-[10px] font-semibold leading-tight text-center">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Stat cards ── */}
      <div>
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Ringkasan Petugas</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {officerStats === undefined
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] w-full rounded-xl" />)
            : <>
              <StatCard label="Total" value={officerStats.total} icon={Users} />
              <StatCard label="Aktif" value={officerStats.aktif} icon={UserCheck} tone="accent" />
              <StatCard label="Cuti" value={officerStats.cuti} icon={Plane} tone="warning" />
              <StatCard label="Nonaktif" value={officerStats.nonaktif} icon={UserMinus} tone="danger" />
            </>
          }
        </div>
      </div>

      {/* ── Feed sections ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader icon={BookOpen} title="Laporan Harian" linkTo="/insiden" />
          <LaporanHarianFeed />
        </div>
        <div>
          <SectionHeader icon={AlertTriangle} title="Berita Acara Kejadian" linkTo="/insiden" />
          <BeritaAcaraFeed />
        </div>
        <div>
          <SectionHeader icon={MapPin} title="Laporan Patroli" linkTo="/patroli" />
          <PatroliFeed />
        </div>
        <div>
          <SectionHeader icon={RefreshCw} title="Serah Terima Shift" linkTo="/perlengkapan" />
          <SerahTerimaFeed />
        </div>
      </div>

      {/* Bottom padding for mobile nav */}
      <div className="h-4" />
    </div>
  );
}
