import { useState } from "react";
import { useQuery } from "convex/react";
import { format, subDays, startOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Download, CalendarDays, UserCheck, Clock, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import StatCard from "@/components/stat-card.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { CalendarDays as CalendarIcon } from "lucide-react";

type RekapRow = {
  officerId: string;
  nama: string;
  jabatan: string;
  lokasiTugas: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpha: number;
  total: number;
};

function Badge2({ count, cls }: { count: number; cls: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {count}
    </span>
  );
}

function downloadExcel(rows: RekapRow[], mulai: string, selesai: string) {
  const data = rows.map((r) => ({
    Nama: r.nama,
    Jabatan: r.jabatan,
    Penempatan: r.lokasiTugas,
    Hadir: r.hadir,
    Terlambat: r.terlambat,
    Izin: r.izin,
    Sakit: r.sakit,
    Alpha: r.alpha,
    "Total Hari Dicatat": r.total,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");

  // Auto-fit columns
  const colWidths = Object.keys(data[0] ?? {}).map((k) => ({
    wch: Math.max(k.length, ...data.map((row) => String(row[k as keyof typeof row] ?? "").length)) + 2,
  }));
  ws["!cols"] = colWidths;

  XLSX.writeFile(wb, `Rekap_Absensi_${mulai}_${selesai}.xlsx`);
}

export default function RekapAbsensiTab() {
  const today = format(new Date(), "yyyy-MM-dd");
  const firstOfMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [mulai, setMulai] = useState(firstOfMonth);
  const [selesai, setSelesai] = useState(today);

  const data = useQuery(api.shifts.rekapAbsensi, { tanggalMulai: mulai, tanggalSelesai: selesai });

  const totalHadir = data?.reduce((s, r) => s + r.hadir, 0) ?? 0;
  const totalTerlambat = data?.reduce((s, r) => s + r.terlambat, 0) ?? 0;
  const totalAlpha = data?.reduce((s, r) => s + r.alpha, 0) ?? 0;
  const totalSemua = data?.reduce((s, r) => s + r.total, 0) ?? 0;

  const displayRange = mulai && selesai
    ? `${format(new Date(mulai + "T12:00:00"), "d MMM", { locale: idLocale })} – ${format(new Date(selesai + "T12:00:00"), "d MMM yyyy", { locale: idLocale })}`
    : "—";

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Dari tanggal</label>
          <Input type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} className="w-40 h-8 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Sampai tanggal</label>
          <Input type="date" value={selesai} onChange={(e) => setSelesai(e.target.value)} className="w-40 h-8 text-sm" />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="secondary" size="sm" onClick={() => { setMulai(firstOfMonth); setSelesai(today); }}>
            Bulan Ini
          </Button>
          <Button variant="secondary" size="sm" onClick={() => {
            const s = format(subDays(new Date(), 6), "yyyy-MM-dd");
            setMulai(s); setSelesai(today);
          }}>
            7 Hari
          </Button>
          {data && data.length > 0 && (
            <Button size="sm" onClick={() => downloadExcel(data, mulai, selesai)}>
              <Download className="size-4 mr-1.5" /> Download Excel
            </Button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      {data === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px] w-full" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Tercatat" value={totalSemua} icon={CalendarDays} />
          <StatCard label="Hadir" value={totalHadir} icon={UserCheck} tone="accent" />
          <StatCard label="Terlambat" value={totalTerlambat} icon={Clock} />
          <StatCard label="Alpha" value={totalAlpha} icon={AlertTriangle} tone="danger" />
        </div>
      )}

      {/* Table */}
      <div>
        <div className="mb-2 text-sm text-muted-foreground">
          Periode: <span className="font-medium text-foreground">{displayRange}</span>
          {data && <span className="ml-2">· {data.length} petugas</span>}
        </div>

        {data === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : data.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarIcon /></EmptyMedia>
              <EmptyTitle>Tidak ada data absensi</EmptyTitle>
              <EmptyDescription>Belum ada catatan absensi pada periode ini.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="space-y-3 md:hidden">
              {data.map((row) => (
                <div key={row.officerId} className="rounded-xl border bg-card p-4 space-y-3">
                  <div>
                    <div className="font-semibold">{row.nama}</div>
                    <div className="text-xs text-muted-foreground">{row.jabatan} · {row.lokasiTugas}</div>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Hadir</div>
                      <Badge2 count={row.hadir} cls="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Lambat</div>
                      <Badge2 count={row.terlambat} cls="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Izin</div>
                      <Badge2 count={row.izin} cls="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Sakit</div>
                      <Badge2 count={row.sakit} cls="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Alpha</div>
                      {row.alpha > 0
                        ? <Badge variant="destructive" className="text-xs">{row.alpha}</Badge>
                        : <Badge2 count={0} cls="bg-muted text-muted-foreground" />
                      }
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">Total dicatat: <span className="font-semibold text-foreground">{row.total}</span></div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead>Penempatan</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Terlambat</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Alpha</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.officerId}>
                      <TableCell className="font-medium">{row.nama}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.jabatan}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.lokasiTugas}</TableCell>
                      <TableCell className="text-center">
                        <Badge2 count={row.hadir} cls="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge2 count={row.terlambat} cls="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge2 count={row.izin} cls="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge2 count={row.sakit} cls="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" />
                      </TableCell>
                      <TableCell className="text-center">
                        {row.alpha > 0
                          ? <Badge variant="destructive" className="text-xs">{row.alpha}</Badge>
                          : <Badge2 count={0} cls="bg-muted text-muted-foreground" />
                        }
                      </TableCell>
                      <TableCell className="text-center font-semibold">{row.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
