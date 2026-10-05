import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { format, subMonths } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import {
  Users,
  CheckCircle2,
  Shield,
  MapPin,
  Calendar,
  Clock,
  List,
  Map as MapIcon,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";
import "leaflet/dist/leaflet.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type PersonilBerjaga = {
  officerId: Id<"officers">;
  nama: string;
  jabatan: string;
  lokasiTugas: string;
  kodeShift: string;
  regu: { _id: Id<"regu">; nama: string; isNonShift: boolean } | null;
  isDanru: boolean;
  isWadanru: boolean;
  absensi: { status: string; waktuMasuk?: string; waktuKeluar?: string } | null;
  lokasiGPS: { lat: number; lng: number } | null;
  sedangPatroli: boolean;
  tugasPatroliId: Id<"tugasPatroli"> | null;
};

type TugasRow = {
  _id: Id<"tugasPatroli">;
  tanggal: string;
  jamMulaiRencana: string;
  jamSelesaiRencana: string;
  status: "dijadwalkan" | "berlangsung" | "selesai" | "dibatalkan";
  lokasiTerakhir?: { lat: number; lng: number };
  waktuMulai?: string;
  rute: { _id: string; nama: string; estimasiMenit: number } | null;
  officer: { _id: string; nama: string; jabatan: string } | null;
  totalCheckpoints: number;
  checkpointsDikunjungi: number;
};

type ReguGroup = {
  reguId: string;
  reguNama: string;
  isNonShift: boolean;
  personil: PersonilBerjaga[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  dijadwalkan: { label: "Dijadwalkan", cls: "bg-secondary text-secondary-foreground" },
  berlangsung: { label: "Berlangsung", cls: "bg-blue-600 text-white" },
  selesai: { label: "Selesai", cls: "bg-green-600 text-white" },
  dibatalkan: { label: "Dibatalkan", cls: "bg-destructive text-white" },
};

const ABSENSI_BADGE: Record<string, { label: string; cls: string }> = {
  hadir: { label: "Hadir", cls: "bg-green-600 text-white" },
  terlambat: { label: "Terlambat", cls: "bg-yellow-500 text-white" },
  izin: { label: "Izin", cls: "bg-blue-500 text-white" },
  sakit: { label: "Sakit", cls: "bg-orange-500 text-white" },
  alpha: { label: "Alpha", cls: "bg-destructive text-white" },
};

const NO_REGU_KEY = "tanpa-regu";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

/** Sort personil: Danru first, Wadanru second, rest alphabetical */
function sortPersonil(list: PersonilBerjaga[]): PersonilBerjaga[] {
  return [...list].sort((a, b) => {
    if (a.isDanru && !b.isDanru) return -1;
    if (!a.isDanru && b.isDanru) return 1;
    if (a.isWadanru && !b.isWadanru) return -1;
    if (!a.isWadanru && b.isWadanru) return 1;
    return a.nama.localeCompare(b.nama);
  });
}

function groupByRegu(personil: PersonilBerjaga[]): ReguGroup[] {
  const map = new Map<string, ReguGroup>();

  for (const p of personil) {
    const key = p.regu?._id ?? NO_REGU_KEY;
    if (!map.has(key)) {
      map.set(key, {
        reguId: key,
        reguNama: p.regu?.nama ?? "Tanpa Regu",
        isNonShift: p.regu?.isNonShift ?? false,
        personil: [],
      });
    }
    map.get(key)!.personil.push(p);
  }

  // Sort each group's personil
  const groups = Array.from(map.values());
  for (const g of groups) {
    g.personil = sortPersonil(g.personil);
  }

  // Named regu first (sorted alphabetically), "Tanpa Regu" last
  return groups.sort((a, b) => {
    if (a.reguId === NO_REGU_KEY) return 1;
    if (b.reguId === NO_REGU_KEY) return -1;
    return a.reguNama.localeCompare(b.reguNama);
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCards({
  counts,
  sedangPatroli,
}: {
  counts: { total: number; hadir: number; belumAbsen: number } | undefined;
  sedangPatroli: number;
}) {
  if (counts === undefined) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Personil Berjaga",
      value: counts.total,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "Sudah Hadir",
      value: `${counts.hadir} / ${counts.total}`,
      icon: CheckCircle2,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/40",
    },
    {
      label: "Sedang Patroli",
      value: sedangPatroli,
      icon: Shield,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/40",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="flex items-center gap-3 py-4">
            <div className={cn("rounded-lg p-2.5", s.bg)}>
              <s.icon className={cn("size-5", s.color)} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PersonilRow({ p }: { p: PersonilBerjaga }) {
  const badge = p.absensi ? ABSENSI_BADGE[p.absensi.status] : null;

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors">
      {/* GPS indicator dot */}
      <div
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          p.sedangPatroli
            ? "bg-blue-500 animate-pulse"
            : p.absensi
              ? "bg-green-500"
              : "bg-muted-foreground/40",
        )}
        title={
          p.sedangPatroli
            ? "Sedang patroli"
            : p.absensi
              ? "Hadir"
              : "Belum absen"
        }
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{p.nama}</span>
          {p.isDanru && (
            <Badge className="bg-amber-600 text-white text-[10px] px-1.5 py-0">
              DANRU
            </Badge>
          )}
          {p.isWadanru && (
            <Badge className="bg-sky-600 text-white text-[10px] px-1.5 py-0">
              WADANRU
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
          <span>{p.jabatan}</span>
          <span className="text-muted-foreground/50">|</span>
          <span>{p.kodeShift}</span>
          {p.lokasiGPS && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <span className="flex items-center gap-0.5">
                <MapPin className="size-3" />
                {p.lokasiGPS.lat.toFixed(4)}, {p.lokasiGPS.lng.toFixed(4)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Absensi badge */}
      <div className="shrink-0">
        {badge ? (
          <Badge className={cn("text-xs", badge.cls)}>{badge.label}</Badge>
        ) : (
          <Badge className="bg-muted text-muted-foreground text-xs">
            Belum Absen
          </Badge>
        )}
      </div>
    </div>
  );
}

function DaftarView({ groups }: { groups: ReguGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
        Tidak ada personil berjaga hari ini
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.reguId} className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{g.reguNama}</span>
              {g.isNonShift && (
                <Badge className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0">
                  NON SHIFT
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {g.personil.length} personil
            </span>
          </div>
          <div className="divide-y">
            {g.personil.map((p) => (
              <PersonilRow key={p.officerId} p={p} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PetaView({ personil }: { personil: PersonilBerjaga[] }) {
  const withLocation = personil.filter((p) => p.lokasiGPS);

  if (withLocation.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
        Belum ada personil dengan data GPS
      </div>
    );
  }

  const center: [number, number] = [
    withLocation[0].lokasiGPS!.lat,
    withLocation[0].lokasiGPS!.lng,
  ];

  return (
    <div className="rounded-lg overflow-hidden border" style={{ height: "350px" }}>
      <MapContainer center={center} zoom={15} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withLocation.map((p) => {
          const color = p.sedangPatroli
            ? "#3b82f6"
            : p.absensi
              ? "#22c55e"
              : "#9ca3af";

          return (
            <CircleMarker
              key={p.officerId}
              center={[p.lokasiGPS!.lat, p.lokasiGPS!.lng]}
              radius={8}
              pathOptions={{ color, fillColor: color, fillOpacity: 1 }}
            >
              <Tooltip>
                <div className="text-sm space-y-0.5">
                  <p className="font-semibold">{p.nama}</p>
                  <p className="text-muted-foreground">{p.jabatan}</p>
                  <p>
                    {p.sedangPatroli
                      ? "Sedang patroli"
                      : p.absensi
                        ? `Hadir (${p.absensi.status})`
                        : "Belum absen"}
                  </p>
                  {p.regu && <p>Regu: {p.regu.nama}</p>}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

// ─── History section (preserved from original) ───────────────────────────────

function HistorySection() {
  const navigate = useNavigate();
  const currentMonth = format(new Date(), "yyyy-MM");
  const [historyBulan, setHistoryBulan] = useState(currentMonth);

  const historyStart = historyBulan + "-01";
  const historyEnd = historyBulan + "-31";
  const historyTugas = useQuery(api.patroli.listTugasRange, {
    tanggalMulai: historyStart,
    tanggalSelesai: historyEnd,
  }) as TugasRow[] | undefined;

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return {
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy", { locale: idLocale }),
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Calendar className="size-4" /> Riwayat Patroli
        </h2>
        <Select value={historyBulan} onValueChange={setHistoryBulan}>
          <SelectTrigger className="w-48 cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem
                key={m.value}
                value={m.value}
                className="capitalize cursor-pointer"
              >
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {historyTugas === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : historyTugas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          Tidak ada riwayat patroli pada bulan ini
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Tanggal
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Petugas
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Rute
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Progress
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {historyTugas.map((row) => {
                const sc = STATUS_CONFIG[row.status] ?? {
                  label: row.status,
                  cls: "bg-secondary text-secondary-foreground",
                };
                const pct =
                  row.totalCheckpoints > 0
                    ? Math.round(
                        (row.checkpointsDikunjungi / row.totalCheckpoints) * 100,
                      )
                    : 0;
                return (
                  <tr
                    key={row._id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/patroli/tugas/${row._id}`)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {format(
                        new Date(row.tanggal + "T12:00:00"),
                        "d MMM yyyy",
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>{row.officer?.nama ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.officer?.jabatan}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.rute?.nama ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 w-20" />
                        <span className="text-xs text-muted-foreground">
                          {row.checkpointsDikunjungi}/{row.totalCheckpoints}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={sc.cls}>{sc.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MonitoringTab() {
  const today = todayString();
  const [view, setView] = useState<"daftar" | "peta">("daftar");

  const personilData = useQuery(api.liveTracking.getPersonilBerjaga, {
    tanggal: today,
  });
  const countData = useQuery(api.liveTracking.getShiftPersonilCount, {
    tanggal: today,
  });

  const personil = personilData ?? [];
  const sedangPatroli = personil.filter((p) => p.sedangPatroli).length;

  const groups = useMemo(() => groupByRegu(personil), [personil]);

  const isLoading = personilData === undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 animate-pulse" />
          Live Tracking —{" "}
          <span className="font-normal text-muted-foreground capitalize">
            {format(new Date(), "EEEE, d MMM yyyy", { locale: idLocale })}
          </span>
        </h2>
      </div>

      {/* Stat Cards */}
      <StatCards counts={countData} sedangPatroli={sedangPatroli} />

      {/* View toggle */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="size-4" /> Personil Berjaga
          </h2>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setView("daftar")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer transition-colors",
                view === "daftar"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <List className="size-3.5" />
              Daftar
            </button>
            <button
              onClick={() => setView("peta")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer transition-colors",
                view === "peta"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <MapIcon className="size-3.5" />
              Peta
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : view === "daftar" ? (
          <DaftarView groups={groups} />
        ) : (
          <PetaView personil={personil} />
        )}
      </div>

      {/* Map legend (only when viewing peta) */}
      {view === "peta" && !isLoading && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-blue-500" />
            Sedang Patroli
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-green-500" />
            Hadir
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-gray-400" />
            Belum Absen
          </span>
        </div>
      )}

      {/* Riwayat Patroli */}
      <HistorySection />
    </div>
  );
}
