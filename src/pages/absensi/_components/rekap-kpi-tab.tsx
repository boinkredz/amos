import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { format, startOfMonth, subDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import * as XLSX from "xlsx";
import {
  AlertTriangle, ArrowLeftRight, BarChart3, Clock, Download, LogOut, Search, UserCheck, Users, Wallet,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import type { FunctionReturnType } from "convex/server";
import type { LucideIcon } from "lucide-react";

type Rekap = FunctionReturnType<typeof api.kpi.getRekapKpi>;
type PersonelRow = Rekap["personel"][number];
type KekuranganRow = Rekap["kekurangan"][number];

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

function persenTone(p: number) {
  if (p >= 95) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (p >= 80) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

function Num({ n, warn }: { n: number; warn?: boolean }) {
  return <span className={cn("tabular-nums", n === 0 ? "text-muted-foreground" : warn && "font-semibold text-destructive")}>{n}</span>;
}

type Tone = "default" | "good" | "bad";
const TILE_TONES: Record<Tone, string> = {
  default: "bg-secondary text-secondary-foreground",
  good: "bg-accent/20 text-accent-foreground dark:text-accent",
  bad: "bg-destructive/15 text-destructive",
};

function SummaryTile({ label, value, hint, icon: Icon, tone = "default" }: {
  label: string; value: string | number; hint?: string; icon: LucideIcon; tone?: Tone;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", TILE_TONES[tone])}>
          <Icon className="size-4" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="break-words text-xl font-bold leading-tight tabular-nums sm:text-2xl">{value}</div>
      {hint && <div className="text-[11px] leading-tight text-muted-foreground">{hint}</div>}
    </div>
  );
}

function downloadExcel(personel: PersonelRow[], kekurangan: KekuranganRow[], mulai: string, selesai: string) {
  const wb = XLSX.utils.book_new();
  const sheet1 = XLSX.utils.json_to_sheet(
    personel.map((r) => ({
      Nama: r.nama,
      Jabatan: r.jabatan,
      Regu: r.regu,
      "Shift Terjadwal": r.terjadwal,
      Hadir: r.hadir,
      "% Kehadiran": r.persenHadir,
      Terlambat: r.terlambat,
      "Total Menit Terlambat": r.menitTerlambat,
      "Pulang Cepat": r.pulangCepat,
      Izin: r.izin,
      Sakit: r.sakit,
      Alpha: r.alpha,
      "Tanpa Keterangan": r.tanpaKeterangan,
      Berhalangan: r.berhalangan,
      "Jadi Backup": r.backup,
      "Tukar Shift": r.tukarShift,
      "Total Denda": r.denda,
    })),
  );
  XLSX.utils.book_append_sheet(wb, sheet1, "KPI Personel");
  const sheet2 = XLSX.utils.json_to_sheet(
    kekurangan.map((k) => ({
      Site: k.siteNama,
      Shift: k.shiftNama,
      "Jumlah Hari": k.hari,
      "Total Kebutuhan": k.kebutuhan,
      "Total Hadir": k.hadir,
      "Total Kekurangan": k.kurang,
      "Hari Kurang Personel": k.hariKurang,
    })),
  );
  XLSX.utils.book_append_sheet(wb, sheet2, "Kekurangan Personel");
  XLSX.writeFile(wb, `Rekap_KPI_${mulai}_${selesai}.xlsx`);
}

export default function RekapKpiTab() {
  const today = format(new Date(), "yyyy-MM-dd");
  const firstOfMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const [mulai, setMulai] = useState(firstOfMonth);
  const [selesai, setSelesai] = useState(today);
  const [cari, setCari] = useState("");

  const valid = !!mulai && !!selesai && mulai <= selesai;
  const data = useQuery(api.kpi.getRekapKpi, valid ? { tanggalMulai: mulai, tanggalSelesai: selesai } : "skip");

  const personel = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (data?.personel ?? []).filter((r) => !q || r.nama.toLowerCase().includes(q) || r.regu.toLowerCase().includes(q));
  }, [data, cari]);

  const totals = useMemo(() => {
    const p = data?.personel ?? [];
    const sum = (k: "terjadwal" | "hadir" | "terlambat" | "pulangCepat" | "denda" | "backup" | "tukarShift" | "tanpaKeterangan" | "alpha") =>
      p.reduce((s, r) => s + r[k], 0);
    const terjadwal = sum("terjadwal");
    return {
      persen: terjadwal > 0 ? Math.round((Math.min(sum("hadir"), terjadwal) / terjadwal) * 100) : 0,
      terlambat: sum("terlambat"),
      pulangCepat: sum("pulangCepat"),
      absen: sum("alpha") + sum("tanpaKeterangan"),
      kurang: (data?.kekurangan ?? []).reduce((s, k) => s + k.kurang, 0),
      backupTukar: sum("backup") + sum("tukarShift"),
      denda: sum("denda"),
    };
  }, [data]);

  const range = valid
    ? `${format(new Date(`${mulai}T12:00:00`), "d MMM", { locale: idLocale })} – ${format(new Date(`${selesai}T12:00:00`), "d MMM yyyy", { locale: idLocale })}`
    : "—";

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Dari tanggal</label>
          <Input type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} className="h-8 w-40 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Sampai tanggal</label>
          <Input type="date" value={selesai} onChange={(e) => setSelesai(e.target.value)} className="h-8 w-40 text-sm" />
        </div>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          <Button variant="secondary" size="sm" className="cursor-pointer" onClick={() => { setMulai(firstOfMonth); setSelesai(today); }}>
            Bulan Ini
          </Button>
          <Button variant="secondary" size="sm" className="cursor-pointer" onClick={() => { setMulai(format(subDays(new Date(), 6), "yyyy-MM-dd")); setSelesai(today); }}>
            7 Hari
          </Button>
          {data && data.personel.length > 0 && (
            <Button size="sm" className="cursor-pointer" onClick={() => downloadExcel(data.personel, data.kekurangan, mulai, selesai)}>
              <Download className="size-4" /> Excel
            </Button>
          )}
        </div>
      </div>

      {!valid && <p className="text-sm text-destructive">Tanggal mulai harus sebelum tanggal selesai.</p>}

      {/* Summary */}
      {data === undefined ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[104px] w-full" />)}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Kehadiran" value={`${totals.persen}%`} icon={UserCheck} tone="good" />
          <SummaryTile label="Terlambat" value={totals.terlambat} icon={Clock} />
          <SummaryTile label="Pulang cepat" value={totals.pulangCepat} icon={LogOut} />
          <SummaryTile label="Absen" value={totals.absen} icon={AlertTriangle} tone="bad" hint="Alpha + tanpa keterangan" />
          <SummaryTile label="Kekurangan" value={totals.kurang} icon={Users} tone="bad" hint="Total orang kurang" />
          <SummaryTile label="Backup / tukar" value={totals.backupTukar} icon={ArrowLeftRight} />
          <SummaryTile label="Total denda" value={rupiah(totals.denda)} icon={Wallet} />
          <SummaryTile label="Personel" value={data.personel.length} icon={BarChart3} />
        </div>
      )}

      {/* Per personel */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">KPI per Personel</h3>
            <p className="text-xs text-muted-foreground">
              Periode {range}
              {data && ` · Denda ${rupiah(data.aturan.dendaTerlambat)}/terlambat, ${rupiah(data.aturan.dendaPulangCepat)}/pulang cepat`}
            </p>
          </div>
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau regu" className="h-8 pl-8 text-sm" />
          </div>
        </div>

        {data === undefined ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : personel.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><BarChart3 /></EmptyMedia>
              <EmptyTitle>{cari ? "Tidak ditemukan" : "Belum ada data"}</EmptyTitle>
              <EmptyDescription>{cari ? "Coba kata kunci lain." : "Belum ada jadwal atau absensi pada periode ini."}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {personel.map((r) => (
                <div key={r.officerId} className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{r.nama}</div>
                      <div className="truncate text-xs text-muted-foreground">{[r.jabatan, r.regu].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", persenTone(r.persenHadir))}>
                      {r.persenHadir}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    {[
                      ["Hadir", `${r.hadir}/${r.terjadwal}`],
                      ["Terlambat", r.terlambat],
                      ["Pulang cpt", r.pulangCepat],
                      ["Absen", r.alpha + r.tanpaKeterangan],
                      ["Izin/Sakit", r.izin + r.sakit],
                      ["Berhalangan", r.berhalangan],
                      ["Backup", r.backup],
                      ["Tukar", r.tukarShift],
                    ].map(([label, val]) => (
                      <div key={label} className="rounded-lg bg-muted/50 py-1.5">
                        <div className="text-[10px] text-muted-foreground">{label}</div>
                        <div className="font-semibold tabular-nums">{val}</div>
                      </div>
                    ))}
                  </div>
                  {r.denda > 0 && (
                    <div className="text-right text-xs text-muted-foreground">
                      Denda: <span className="font-semibold text-destructive">{rupiah(r.denda)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-md border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Regu</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead className="text-center">Terlambat</TableHead>
                    <TableHead className="text-center">Pulang cepat</TableHead>
                    <TableHead className="text-center">Izin/Sakit</TableHead>
                    <TableHead className="text-center">Absen</TableHead>
                    <TableHead className="text-center">Berhalangan</TableHead>
                    <TableHead className="text-center">Backup</TableHead>
                    <TableHead className="text-center">Tukar</TableHead>
                    <TableHead className="text-right">Denda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personel.map((r) => (
                    <TableRow key={r.officerId}>
                      <TableCell>
                        <div className="font-medium">{r.nama}</div>
                        <div className="text-xs text-muted-foreground">{r.jabatan}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.regu || "—"}</TableCell>
                      <TableCell className="text-center tabular-nums">{r.hadir}/{r.terjadwal}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", persenTone(r.persenHadir))}>{r.persenHadir}%</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Num n={r.terlambat} warn />
                        {r.menitTerlambat > 0 && <div className="text-[10px] text-muted-foreground">{r.menitTerlambat} mnt</div>}
                      </TableCell>
                      <TableCell className="text-center"><Num n={r.pulangCepat} warn /></TableCell>
                      <TableCell className="text-center"><Num n={r.izin + r.sakit} /></TableCell>
                      <TableCell className="text-center"><Num n={r.alpha + r.tanpaKeterangan} warn /></TableCell>
                      <TableCell className="text-center"><Num n={r.berhalangan} /></TableCell>
                      <TableCell className="text-center"><Num n={r.backup} /></TableCell>
                      <TableCell className="text-center"><Num n={r.tukarShift} /></TableCell>
                      <TableCell className={cn("text-right tabular-nums", r.denda > 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                        {rupiah(r.denda)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>

      {/* Shortage */}
      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Kekurangan Personel per Site & Shift</h3>
          <p className="text-xs text-muted-foreground">Dihitung per hari sampai hari ini: kebutuhan dikurangi yang check-in.</p>
        </div>
        {data === undefined ? (
          <Skeleton className="h-24 w-full" />
        ) : data.kekurangan.length === 0 ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Belum ada jadwal pada periode ini.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.kekurangan.map((k) => (
              <div key={`${k.siteId}-${k.shiftId}`} className="space-y-2 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{k.siteNama}</div>
                    <div className="text-xs text-muted-foreground">{k.shiftNama} · {k.hari} hari</div>
                  </div>
                  {k.kurang > 0
                    ? <Badge variant="destructive" className="shrink-0">Kurang {k.kurang}</Badge>
                    : <Badge variant="secondary" className="shrink-0">Lengkap</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted/50 py-1.5"><div className="text-[10px] text-muted-foreground">Kebutuhan</div><div className="font-semibold tabular-nums">{k.kebutuhan}</div></div>
                  <div className="rounded-lg bg-muted/50 py-1.5"><div className="text-[10px] text-muted-foreground">Hadir</div><div className="font-semibold tabular-nums">{k.hadir}</div></div>
                  <div className="rounded-lg bg-muted/50 py-1.5"><div className="text-[10px] text-muted-foreground">Hari kurang</div><div className="font-semibold tabular-nums">{k.hariKurang}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
