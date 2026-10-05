import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Printer, FileText, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import LaporanHarianPreview from "./laporan-harian-preview.tsx";
import { buildLaporanHarianHtml } from "../_lib/laporan-harian-html.ts";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type Props = { laporanId: Id<"laporanHarian">; onClose: () => void };

export default function LaporanHarianDetailPanel({ laporanId, onClose }: Props) {
  const laporan = useQuery(api.insiden.getLaporanHarian, { laporanId });
  const [exporting, setExporting] = useState(false);

  function handlePrint() {
    if (!laporan) return;
    const html = buildLaporanHarianHtml(laporan);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 800);
  }

  async function handleDownloadWord() {
    if (!laporan) return;
    setExporting(true);
    try {
      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, WidthType, BorderStyle,
      } = await import("docx");

      const noBorder = {
        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      };
      const solidBorder = {
        top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 },
      };

      const sectionTitle = (text: string) =>
        new Paragraph({ children: [new TextRun({ text, bold: true, underline: {} })], spacing: { before: 120, after: 80 } });

      const infoRow = (label: string, value: string) =>
        new TableRow({
          children: [
            new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: noBorder, children: [new Paragraph({ children: [new TextRun(label)] })] }),
            new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, borders: noBorder, children: [new Paragraph({ children: [new TextRun(":")] })] }),
            new TableCell({ width: { size: 65, type: WidthType.PERCENTAGE }, borders: noBorder, children: [new Paragraph({ children: [new TextRun(value)] })] }),
          ],
        });

      const tanggalFormatted = format(new Date(laporan.tanggal), "EEEE, d MMMM yyyy", { locale: localeId });
      const tanggalShort = format(new Date(laporan.tanggal), "d MMMM yyyy", { locale: localeId });
      const dash = "—";

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: { width: 12189, height: 18709 },
              margin: { top: 1134, right: 1418, bottom: 1134, left: 1701 },
            },
          },
          children: [
            new Paragraph({ children: [new TextRun({ text: "LAPORAN HARIAN PROJECT", bold: true, size: 26 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: "PENGECEKAN KINERJA PENGAMANAN", size: 18 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
              infoRow("Hari / Tanggal", tanggalFormatted),
              infoRow("Shift", laporan.shift),
              infoRow("Dibuat Oleh", `${laporan.namaPembuat} — ${laporan.jabatanPembuat}`),
            ]}),
            new Paragraph({ text: "" }),
            sectionTitle("I. JUMLAH PERSONIL"),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
              new TableRow({ children: [
                new TableCell({ borders: solidBorder, width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Keterangan", bold: true })] })] }),
                new TableCell({ borders: solidBorder, width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Jumlah", bold: true })] })] }),
              ]}),
              new TableRow({ children: [
                new TableCell({ borders: solidBorder, children: [new Paragraph({ children: [new TextRun("Personil seharusnya bertugas")] })] }),
                new TableCell({ borders: solidBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(String(laporan.personilHarusnya))] })] }),
              ]}),
              new TableRow({ children: [
                new TableCell({ borders: solidBorder, children: [new Paragraph({ children: [new TextRun("Personil hadir")] })] }),
                new TableCell({ borders: solidBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(String(laporan.personilHadir))] })] }),
              ]}),
              new TableRow({ children: [
                new TableCell({ borders: solidBorder, children: [new Paragraph({ children: [new TextRun("Status kehadiran")] })] }),
                new TableCell({ borders: solidBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(laporan.statusKehadiran === "lengkap" ? "Lengkap" : "Tidak Lengkap")] })] }),
              ]}),
            ]}),
            sectionTitle("II. KETERLAMBATAN PERSONIL"),
            new Paragraph({ children: [new TextRun(laporan.adaTerlambat ? (laporan.detailTerlambat ?? dash) : dash)] }),
            sectionTitle("III. ABSENSI PERSONIL & BACK-UP"),
            new Paragraph({ children: [new TextRun(laporan.adaAbsen ? (laporan.detailAbsen ?? dash) : dash)] }),
            ...(laporan.adaAbsen && laporan.detailBackup ? [new Paragraph({ children: [new TextRun(`Backup: ${laporan.detailBackup}`)] })] : []),
            sectionTitle("IV. PENGECEKAN KONDISI FISIK & KELENGKAPAN KERJA PERSONIL"),
            ...(laporan.cekFisik.length === 0
              ? [new Paragraph({ children: [new TextRun(dash)] })]
              : [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
                  new TableRow({ children: ["#","Nama","Jabatan","Pos/Rotasi","Kondisi Fisik","Kelengkapan","Ket."].map(h =>
                    new TableCell({ borders: solidBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true })] })] })) }),
                  ...laporan.cekFisik.map((item, i) =>
                    new TableRow({ children: [String(i+1),item.nama,item.jabatan,item.posRotasi,item.kondisiFisik,item.kelengkapanKerja,item.keterangan||dash].map(v =>
                      new TableCell({ borders: solidBorder, children: [new Paragraph({ children: [new TextRun(v)] })] })) })),
                ]})]
            ),
            sectionTitle("V. PENGECEKAN PERALATAN & PERLENGKAPAN KERJA"),
            ...(laporan.cekPeralatan.length === 0
              ? [new Paragraph({ children: [new TextRun(dash)] })]
              : [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
                  new TableRow({ children: ["#","Nama Peralatan","Std","Tersedia","Kondisi","Keterangan"].map(h =>
                    new TableCell({ borders: solidBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true })] })] })) }),
                  ...laporan.cekPeralatan.map((item, i) =>
                    new TableRow({ children: [String(i+1),item.namaAlat,String(item.jmlStandar),String(item.jmlTersedia),item.kondisi,item.keterangan||dash].map(v =>
                      new TableCell({ borders: solidBorder, children: [new Paragraph({ children: [new TextRun(v)] })] })) })),
                ]})]
            ),
            sectionTitle("VI. DINAMIKA / HAL MENONJOL"),
            new Paragraph({ children: [new TextRun(laporan.adaDinamika ? (laporan.dinamika ?? dash) : dash)] }),
            sectionTitle("VII. INFORMASI UNTUK REGU BERIKUTNYA"),
            new Paragraph({ children: [new TextRun(laporan.adaInfoRegu ? (laporan.detailInfoRegu ?? dash) : dash)] }),
            sectionTitle("VIII. HAL YANG PERLU DIESKALASI LEBIH LANJUT"),
            new Paragraph({ children: [new TextRun(laporan.adaEskalasi ? (laporan.detailEskalasi ?? dash) : dash)] }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun(`${laporan.lokasiGedung}, ${tanggalShort}`)], alignment: AlignmentType.RIGHT }),
            new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
              new TableRow({ children: [
                new TableCell({ borders: noBorder, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "YANG MEMBUAT,", bold: true })] })] }),
                new TableCell({ borders: noBorder, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MENGETAHUI,", bold: true })] })] }),
              ]}),
              new TableRow({ children: [
                new TableCell({ borders: noBorder, children: [new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" })] }),
                new TableCell({ borders: noBorder, children: [new Paragraph({ text: "" })] }),
              ]}),
              new TableRow({ children: [
                new TableCell({ borders: noBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: laporan.namaPembuat, bold: true })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(laporan.jabatanPembuat)] })] }),
                new TableCell({ borders: noBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: laporan.namaAtasan ?? "MANAJEMEN PENGGUNA JASA", bold: true })] }), ...(laporan.jabatanAtasan ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(laporan.jabatanAtasan)] })] : [])] }),
              ]}),
            ]}),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan-Harian-${laporan.tanggal}-${laporan.shift}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 h-screen bg-background border-l shadow-xl flex flex-col"
        style={{ width: "min(900px, 90vw)" }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background shrink-0">
          <Button size="sm" variant="ghost" onClick={onClose} className="gap-1.5">
            <ArrowLeft className="size-4" /> Tutup
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handlePrint} disabled={!laporan}>
              <Printer className="size-4 mr-1.5" />
              <span className="hidden sm:inline">Cetak / Simpan PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDownloadWord} disabled={!laporan || exporting}>
              <FileText className="size-4 mr-1.5" />
              <span className="hidden sm:inline">{exporting ? "Memproses..." : "Unduh sebagai Word (.doc)"}</span>
              <span className="sm:hidden">Word</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable document area */}
        <div
          className="bg-muted/50"
          style={{ flex: 1, overflowY: "auto", overflowX: "auto", minHeight: 0, padding: "2rem 1rem" }}
        >
          <div style={{ display: "flex", justifyContent: "center", minWidth: "fit-content" }}>
            {!laporan ? (
              <div className="bg-white rounded shadow-sm p-10 space-y-4" style={{ width: "215mm" }}>
                <Skeleton className="h-6 w-48 mx-auto" />
                <Skeleton className="h-4 w-32 mx-auto" />
                <Skeleton className="h-40 w-full mt-4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="shadow-lg rounded overflow-hidden">
                <LaporanHarianPreview laporan={laporan} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
