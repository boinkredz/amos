import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import {
  Sparkles,
  Save,
  FileSpreadsheet,
  FileText,
  Info,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

// ─── Constants ──────────────────────────────────────────────────────────────

const CYCLE = ["P", "P", "M", "M", "L", "L"] as const;
const FASE_LABEL = [
  "Pagi-1",
  "Pagi-2",
  "Malam-1",
  "Malam-2",
  "Libur-1",
  "Libur-2",
] as const;

// Cell cycle order when clicking
const KODE_CYCLE = ["P", "M", "L", "SOC/P", "SOC/M"] as const;

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Hex colors used for exports (excel best-effort + pdf)
const KODE_HEX: Record<string, { bg: string; text: string }> = {
  P: { bg: "DCFCE7", text: "166534" },
  M: { bg: "DBEAFE", text: "1E3A8A" },
  L: { bg: "E5E7EB", text: "374151" },
  "SOC/P": { bg: "FEF3C7", text: "92400E" },
  "SOC/M": { bg: "FEF3C7", text: "92400E" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function toDateStr(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

function getKodeForDate(tanggalMulaiRotasi: string, targetDate: string): string {
  const start = new Date(tanggalMulaiRotasi + "T00:00:00");
  const target = new Date(targetDate + "T00:00:00");
  const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000);
  const offset = ((diffDays % 6) + 6) % 6;
  return CYCLE[offset];
}

function getFaseLabel(tanggalMulaiRotasi: string, targetDate: string): string {
  const start = new Date(tanggalMulaiRotasi + "T00:00:00");
  const target = new Date(targetDate + "T00:00:00");
  const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000);
  const offset = ((diffDays % 6) + 6) % 6;
  return FASE_LABEL[offset];
}

function nextKode(current: string): string {
  const idx = KODE_CYCLE.indexOf(current as (typeof KODE_CYCLE)[number]);
  if (idx === -1) return "P";
  return KODE_CYCLE[(idx + 1) % KODE_CYCLE.length];
}

function cellClasses(kode: string | undefined): string {
  switch (kode) {
    case "P":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "M":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "L":
      return "bg-muted text-muted-foreground";
    case "SOC/P":
    case "SOC/M":
      return "bg-amber-200 text-amber-900 dark:bg-amber-700/50 dark:text-amber-100 font-semibold";
    default:
      return "text-muted-foreground/40";
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Officer = {
  _id: Id<"officers">;
  nama: string;
  jabatan: string;
  lokasiTugas: string;
  seragam?: string;
  reguId?: Id<"regu">;
};

type ReguRow = {
  _id: Id<"regu">;
  nama: string;
  isNonShift: boolean;
  tanggalMulaiRotasi?: string;
};

type GroupRow = {
  reguId: string; // reguId or "none"
  reguNama: string;
  isNonShift: boolean;
  tanggalMulaiRotasi?: string;
  officers: Officer[];
};

// Grid: officerId -> (tanggal -> kode)
type Grid = Record<string, Record<string, string>>;

// ─── Component ──────────────────────────────────────────────────────────────

export default function GenerateJadwalTab() {
  const officers = useQuery(api.officers.list, { status: "aktif" });
  const regus = useQuery(api.regu.list, {});
  const bulkSave = useMutation(api.jadwal.bulkSaveJadwal);

  const now = new Date();
  const [monthValue, setMonthValue] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [tanggalGenerate, setTanggalGenerate] = useState<string>(
    `${monthValue}-01`,
  );
  const [grid, setGrid] = useState<Grid>({});
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [year, month1] = monthValue.split("-").map(Number);
  const numDays = daysInMonth(year, month1);
  const days = useMemo(
    () => Array.from({ length: numDays }, (_, i) => i + 1),
    [numDays],
  );
  const periodeLabel = `${BULAN_ID[month1 - 1]} ${year}`;

  // Build regu-grouped officers
  const groups = useMemo<GroupRow[]>(() => {
    if (!officers || !regus) return [];
    const reguMap = new Map<string, ReguRow>(
      (regus as ReguRow[]).map((r) => [r._id, r]),
    );
    const sortedRegus = [...(regus as ReguRow[])].sort((a, b) =>
      a.nama.localeCompare(b.nama, "id"),
    );
    const result: GroupRow[] = [];
    for (const r of sortedRegus) {
      const members = (officers as Officer[])
        .filter((o) => o.reguId === r._id)
        .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
      if (members.length === 0) continue;
      result.push({
        reguId: r._id,
        reguNama: r.nama,
        isNonShift: r.isNonShift,
        tanggalMulaiRotasi: r.tanggalMulaiRotasi,
        officers: members,
      });
    }
    // Officers without a valid regu
    const tanpaRegu = (officers as Officer[])
      .filter((o) => !o.reguId || !reguMap.has(o.reguId))
      .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
    if (tanpaRegu.length > 0) {
      result.push({
        reguId: "none",
        reguNama: "Tanpa Regu",
        isNonShift: false,
        tanggalMulaiRotasi: undefined,
        officers: tanpaRegu,
      });
    }
    return result;
  }, [officers, regus]);

  const orderedOfficers = useMemo<Officer[]>(
    () => groups.flatMap((g) => g.officers),
    [groups],
  );

  // Fase preview per regu (only shift regus with rotation start date)
  const fasePreview = useMemo(() => {
    return groups
      .filter((g) => g.reguId !== "none")
      .map((g) => {
        let fase: string;
        if (g.isNonShift) fase = "Non Shift (Libur)";
        else if (!g.tanggalMulaiRotasi) fase = "?";
        else fase = getFaseLabel(g.tanggalMulaiRotasi, tanggalGenerate);
        return { nama: g.reguNama, fase };
      });
  }, [groups, tanggalGenerate]);

  function handleMonthChange(value: string) {
    setMonthValue(value);
    setTanggalGenerate(`${value}-01`);
    setGenerated(false);
    setGrid({});
  }

  function handleGenerate() {
    const newGrid: Grid = {};
    for (const g of groups) {
      for (const o of g.officers) {
        const row: Record<string, string> = {};
        for (const d of days) {
          const tanggal = toDateStr(year, month1, d);
          if (g.reguId === "none") {
            row[tanggal] = ""; // manual
          } else if (g.isNonShift) {
            row[tanggal] = "L";
          } else if (g.tanggalMulaiRotasi) {
            row[tanggal] = getKodeForDate(g.tanggalMulaiRotasi, tanggal);
          } else {
            row[tanggal] = ""; // no rotation date → manual
          }
        }
        newGrid[o._id] = row;
      }
    }
    setGrid(newGrid);
    setGenerated(true);
    toast.success("Jadwal berhasil digenerate. Klik sel untuk mengubah kode.");
  }

  function cycleCell(officerId: string, tanggal: string) {
    setGrid((prev) => {
      const current = prev[officerId]?.[tanggal] ?? "";
      const updated: Grid = { ...prev };
      updated[officerId] = { ...(prev[officerId] ?? {}), [tanggal]: nextKode(current) };
      return updated;
    });
  }

  // Flatten grid into entries for saving
  const entries = useMemo(() => {
    const out: { officerId: Id<"officers">; tanggal: string; kode: string }[] = [];
    for (const officerId of Object.keys(grid)) {
      const row = grid[officerId];
      for (const tanggal of Object.keys(row)) {
        const kode = row[tanggal];
        if (kode && KODE_CYCLE.includes(kode as (typeof KODE_CYCLE)[number])) {
          out.push({ officerId: officerId as Id<"officers">, tanggal, kode });
        }
      }
    }
    return out;
  }, [grid]);

  const socCount = useMemo(
    () => entries.filter((e) => e.kode === "SOC/P" || e.kode === "SOC/M").length,
    [entries],
  );

  async function handleSave() {
    setSaving(true);
    try {
      const res = await bulkSave({ periode: monthValue, entries });
      toast.success(
        `Jadwal disimpan: ${res.assignments} penugasan, ${res.bonusSoc} bonus SOC dicatat.`,
      );
      setConfirmOpen(false);
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Gagal menyimpan jadwal";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // ─── Exports ────────────────────────────────────────────────────────────

  function officerRowCells(o: Officer, no: number): string[] {
    const base = [
      String(no),
      o.nama,
      o.jabatan,
      o.lokasiTugas,
      o.seragam ?? "",
    ];
    const dayCells = days.map((d) => grid[o._id]?.[toDateStr(year, month1, d)] ?? "");
    return [...base, ...dayCells];
  }

  function handleExportExcel() {
    const infoHeaders = ["No", "Nama", "Jabatan", "Lokasi Pos", "Seragam"];
    const dayHeaders = days.map((d) => String(d));
    const totalCols = infoHeaders.length + dayHeaders.length;

    const aoa: (string | number)[][] = [];
    // Row 0: title spanning all columns
    const titleRow: string[] = [`JADWAL SHIFT ${periodeLabel.toUpperCase()}`];
    for (let i = 1; i < totalCols; i++) titleRow.push("");
    aoa.push(titleRow);
    // Row 1: header
    aoa.push([...infoHeaders, ...dayHeaders]);

    const merges: XLSX.Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    ];

    let rowIdx = 2;
    let no = 1;
    for (const g of groups) {
      // Regu separator row (merged across all columns)
      const reguRow: string[] = [g.reguNama];
      for (let i = 1; i < totalCols; i++) reguRow.push("");
      aoa.push(reguRow);
      merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols - 1 } });
      rowIdx++;
      for (const o of g.officers) {
        aoa.push(officerRowCells(o, no));
        no++;
        rowIdx++;
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = merges;
    // Column widths
    ws["!cols"] = [
      { wch: 4 }, // No
      { wch: 22 }, // Nama
      { wch: 16 }, // Jabatan
      { wch: 16 }, // Lokasi
      { wch: 10 }, // Seragam
      ...days.map(() => ({ wch: 4 })),
    ];

    // Best-effort cell fill colors (rendered only by style-aware viewers)
    for (let r = 2; r < aoa.length; r++) {
      for (let c = infoHeaders.length; c < totalCols; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell || typeof cell.v !== "string") continue;
        const color = KODE_HEX[cell.v];
        if (color) {
          cell.s = {
            fill: { patternType: "solid", fgColor: { rgb: color.bg } },
            font: { color: { rgb: color.text }, bold: true },
            alignment: { horizontal: "center" },
          };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    const sheetName = `Jadwal ${BULAN_ID[month1 - 1]} ${year}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Jadwal-Shift-${monthValue}.xlsx`);
  }

  function handleExportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text(`JADWAL SHIFT ${periodeLabel.toUpperCase()}`, 14, 12);

    const head = [["No", "Nama", "Jabatan", "Lokasi Pos", "Seragam", ...days.map((d) => String(d))]];

    type PdfCell = { content: string; colSpan?: number; styles?: Record<string, unknown> };
    const body: (string | PdfCell)[][] = [];
    const totalCols = 5 + days.length;
    let no = 1;
    for (const g of groups) {
      body.push([
        {
          content: g.reguNama,
          colSpan: totalCols,
          styles: { fontStyle: "bold", fillColor: [226, 232, 240], textColor: [15, 23, 42] },
        },
      ]);
      for (const o of g.officers) {
        body.push(officerRowCells(o, no));
        no++;
      }
    }

    type AutoTableDoc = {
      autoTable: (opts: Record<string, unknown>) => void;
    };
    (doc as unknown as AutoTableDoc).autoTable({
      head,
      body,
      startY: 16,
      styles: { fontSize: 5.5, cellPadding: 0.6, halign: "center", valign: "middle" },
      headStyles: { fontSize: 5.5, fillColor: [30, 41, 59], halign: "center" },
      columnStyles: {
        0: { cellWidth: 6 },
        1: { cellWidth: 30, halign: "left" },
        2: { cellWidth: 20, halign: "left" },
        3: { cellWidth: 22, halign: "left" },
        4: { cellWidth: 12 },
      },
      didParseCell: (data: {
        section: string;
        column: { index: number };
        cell: { text: string[]; styles: Record<string, unknown> };
      }) => {
        if (data.section === "body" && data.column.index >= 5) {
          const val = data.cell.text[0];
          const color = KODE_HEX[val];
          if (color) {
            const bg = color.bg;
            data.cell.styles.fillColor = [
              parseInt(bg.slice(0, 2), 16),
              parseInt(bg.slice(2, 4), 16),
              parseInt(bg.slice(4, 6), 16),
            ];
          }
        }
      },
    });

    doc.save(`Jadwal-Shift-${monthValue}.pdf`);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const loading = officers === undefined || regus === undefined;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bulan">Bulan</Label>
            <Input
              id="bulan"
              type="month"
              value={monthValue}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tglgen">Tanggal Generate</Label>
            <Input
              id="tglgen"
              type="date"
              value={tanggalGenerate}
              onChange={(e) => setTanggalGenerate(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <Button onClick={handleGenerate} disabled={loading || groups.length === 0}>
            <Sparkles className="size-4" /> Generate
          </Button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" />
          Tanggal Generate menentukan fase rotasi tiap regu pada awal bulan.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Belum ada petugas aktif. Tambahkan petugas terlebih dahulu.
        </p>
      ) : (
        <>
          {/* Fase preview */}
          {generated && fasePreview.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                Fase Rotasi ({periodeLabel})
              </div>
              <div className="flex flex-wrap gap-2">
                {fasePreview.map((f) => (
                  <Badge key={f.nama} variant="secondary" className="text-xs">
                    {f.nama} → {f.fase}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {generated && (
            <>
              {/* Legend + actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Klik sel untuk ubah:</span>
                  <span className={cn("rounded px-2 py-0.5", cellClasses("P"))}>P Pagi</span>
                  <span className={cn("rounded px-2 py-0.5", cellClasses("M"))}>M Malam</span>
                  <span className={cn("rounded px-2 py-0.5", cellClasses("L"))}>L Libur</span>
                  <span className={cn("rounded px-2 py-0.5", cellClasses("SOC/P"))}>SOC/P</span>
                  <span className={cn("rounded px-2 py-0.5", cellClasses("SOC/M"))}>SOC/M</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={handleExportExcel}>
                    <FileSpreadsheet className="size-4" /> Export Excel
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleExportPdf}>
                    <FileText className="size-4" /> Export PDF
                  </Button>
                  <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={entries.length === 0}>
                    <Save className="size-4" /> Simpan Jadwal
                  </Button>
                </div>
              </div>

              {/* Grid */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="sticky left-0 z-10 border-b border-r bg-muted/50 px-2 py-2 text-left font-semibold">No</th>
                      <th className="border-b border-r px-2 py-2 text-left font-semibold min-w-[140px]">Nama</th>
                      <th className="border-b border-r px-2 py-2 text-left font-semibold min-w-[110px]">Jabatan</th>
                      <th className="border-b border-r px-2 py-2 text-left font-semibold min-w-[110px]">Lokasi Pos</th>
                      <th className="border-b border-r px-2 py-2 text-left font-semibold min-w-[70px]">Seragam</th>
                      {days.map((d) => (
                        <th key={d} className="border-b border-r px-1 py-2 text-center font-semibold w-8">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => {
                      let no = 0;
                      // compute starting number for this group
                      const startNo =
                        orderedOfficers.findIndex((o) => o._id === g.officers[0]._id) + 1;
                      return (
                        <Fragment key={`regu-${g.reguId}`}>
                          <tr className="bg-primary/5">
                            <td
                              colSpan={5 + days.length}
                              className="border-b px-2 py-1.5 text-xs font-semibold text-primary"
                            >
                              {g.reguNama}
                              {g.isNonShift && (
                                <span className="ml-2 font-normal text-muted-foreground">
                                  (Non Shift)
                                </span>
                              )}
                              {!g.isNonShift && g.reguId !== "none" && !g.tanggalMulaiRotasi && (
                                <span className="ml-2 font-normal text-amber-600">
                                  (tanpa tanggal rotasi — isi manual)
                                </span>
                              )}
                            </td>
                          </tr>
                          {g.officers.map((o) => {
                            const rowNo = startNo + no;
                            no++;
                            return (
                              <tr key={o._id} className="hover:bg-muted/20">
                                <td className="sticky left-0 z-10 border-b border-r bg-background px-2 py-1 text-center">
                                  {rowNo}
                                </td>
                                <td className="border-b border-r px-2 py-1 font-medium">{o.nama}</td>
                                <td className="border-b border-r px-2 py-1 text-muted-foreground">{o.jabatan}</td>
                                <td className="border-b border-r px-2 py-1 text-muted-foreground">{o.lokasiTugas}</td>
                                <td className="border-b border-r px-2 py-1 text-muted-foreground">{o.seragam ?? "—"}</td>
                                {days.map((d) => {
                                  const tanggal = toDateStr(year, month1, d);
                                  const kode = grid[o._id]?.[tanggal] ?? "";
                                  return (
                                    <td
                                      key={d}
                                      onClick={() => cycleCell(o._id, tanggal)}
                                      className={cn(
                                        "cursor-pointer border-b border-r px-1 py-1 text-center text-[10px] leading-tight select-none",
                                        cellClasses(kode),
                                      )}
                                      title="Klik untuk ubah kode"
                                    >
                                      {kode || "-"}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Confirm save dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simpan Jadwal {periodeLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              {entries.length} penugasan akan disimpan dan menggantikan jadwal bulan ini.
              {socCount > 0
                ? ` Termasuk ${socCount} shift SOC yang akan dicatat sebagai bonus backup.`
                : " Tidak ada shift SOC."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSave();
              }}
              disabled={saving}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
