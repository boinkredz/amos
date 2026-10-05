import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Printer, FileText, X, ArrowLeft, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import BeritaAcaraPreview from "./berita-acara-preview.tsx";
import { buildBeritaAcaraHtml } from "../_lib/berita-acara-html.ts";
import { JENIS_INSIDEN_LABELS } from "../_lib/constants.ts";
import type { JenisInsiden } from "@/convex/schema/insiden";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import BeritaAcaraReviewPanel from "./berita-acara-review-panel.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { cn } from "@/lib/utils.ts";

const STATUS_CONFIG = {
  menunggu: { label: "Menunggu Review", icon: Clock, className: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400" },
  disetujui: { label: "Disetujui", icon: CheckCircle2, className: "text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:text-green-400" },
  ditolak: { label: "Ditolak", icon: XCircle, className: "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-400" },
} as const;

type Props = { baId: Id<"beritaAcara">; onClose: () => void };

export default function BeritaAcaraDetailDialog({ baId, onClose }: Props) {
  const ba = useQuery(api.insiden.getBeritaAcara, { baId });
  const [exporting, setExporting] = useState(false);
  const { canManageOps } = useRole();

  const canReview = canManageOps;
  const baStatus = ba?.status ?? "menunggu";

  function handlePrintOrPdf() {
    if (!ba) return;
    const html = buildBeritaAcaraHtml(ba);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 800);
  }

  async function handleDownloadWord() {
    if (!ba) return;
    setExporting(true);
    try {
      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, WidthType, BorderStyle, ImageRun,
      } = await import("docx");

      const toListItems = (text: string) =>
        text.split("\n").map((s) => s.trim()).filter(Boolean);

      const noBorder = {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      };

      const sectionRow = (label: string, value: string) =>
        new TableRow({
          children: [
            new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: noBorder, children: [new Paragraph({ children: [new TextRun(label)] })] }),
            new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, borders: noBorder, children: [new Paragraph({ children: [new TextRun(":")] })] }),
            new TableCell({ width: { size: 65, type: WidthType.PERCENTAGE }, borders: noBorder, children: [new Paragraph({ children: [new TextRun(value)] })] }),
          ],
        });

      const tanggalFormatted = format(new Date(ba.tanggal), "d MMMM yyyy", { locale: localeId });
      const jenisLabel = JENIS_INSIDEN_LABELS[ba.jenisInsiden as JenisInsiden] ?? ba.jenisInsiden;

      const lampiranImages: { data: ArrayBuffer; width: number; height: number; keterangan: string }[] = [];
      for (const l of ba.lampiran) {
        if (!l.url) continue;
        try {
          const resp = await fetch(l.url);
          const buf = await resp.arrayBuffer();
          lampiranImages.push({ data: buf, width: 400, height: 267, keterangan: l.keterangan || "" });
        } catch { /* skip */ }
      }

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: { width: 12189, height: 18709 },
              margin: { top: 1134, right: 1418, bottom: 1134, left: 1701 },
            },
          },
          children: [
            new Paragraph({ children: [new TextRun({ text: "BERITA ACARA", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun(`NOMOR : ${ba.nomorBA}`)], alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun(`Pada hari ini ${format(new Date(ba.tanggal), "EEEE", { locale: localeId })}, ${tanggalFormatted}, saya yang sedang melaksanakan tugas di bawah ini :`)], alignment: AlignmentType.JUSTIFIED }),
            new Paragraph({ text: "" }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [sectionRow("Nama", ba.petugasNama), sectionRow("Jabatan", ba.petugasJabatan)] }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun("Melaporkan kejadian sebagai berikut :")] }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "A. Informasi Awal :", bold: true, underline: {} })] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                sectionRow("Hari/Tanggal", format(new Date(ba.tanggal), "EEEE, d MMMM yyyy", { locale: localeId })),
                sectionRow("Pukul", `${ba.waktu} WIB`),
                sectionRow("Kejadian", jenisLabel),
                sectionRow("Lokasi", `${ba.lokasiGedung} — ${ba.lokasiDetail}`),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "B. Kronologi Kejadian:", bold: true, underline: {} })] }),
            ...toListItems(ba.kronologi).map((item, i) => new Paragraph({ children: [new TextRun(`${i + 1}. ${item}`)], indent: { left: 360 } })),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "C. Tindakan Yang Dilakukan:", bold: true, underline: {} })] }),
            ...toListItems(ba.tindakan).map((item, i) => new Paragraph({ children: [new TextRun(`${i + 1}. ${item}`)], indent: { left: 360 } })),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "D. Hasil Dari Tindakan Yang Telah Diambil:", bold: true, underline: {} })] }),
            ...toListItems(ba.hasilTindakan).map((item, i) => new Paragraph({ children: [new TextRun(`${i + 1}. ${item}`)], indent: { left: 360 } })),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun("Demikian laporan yang dapat saya sampaikan sebagai bahan periksa Pimpinan. Terima kasih.")], alignment: AlignmentType.JUSTIFIED }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun(`${ba.tempatTtd}, ${tanggalFormatted}`)], alignment: AlignmentType.RIGHT }),
            new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({ children: [
                  new TableCell({ borders: noBorder, width: { size: 33, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "YANG MEMBUAT", bold: true })] })] }),
                  new TableCell({ borders: noBorder, width: { size: 33, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DI PERIKSA", bold: true })] })] }),
                  new TableCell({ borders: noBorder, width: { size: 33, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DI KETAHUI", bold: true })] })] }),
                ]}),
                new TableRow({ children: [
                  new TableCell({ borders: noBorder, children: [new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" })] }),
                  new TableCell({ borders: noBorder, children: [new Paragraph({ text: "" })] }),
                  new TableCell({ borders: noBorder, children: [new Paragraph({ text: "" })] }),
                ]}),
                new TableRow({ children: [
                  new TableCell({ borders: noBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ba.petugasNama, bold: true })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(ba.petugasJabatan)] })] }),
                  new TableCell({ borders: noBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ba.atasanNama ?? "", bold: true })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(ba.atasanJabatan ?? "")] })] }),
                  new TableCell({ borders: noBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ba.ketahuiNama ?? "", bold: true })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(ba.ketahuiJabatan ?? "")] })] }),
                ]}),
              ],
            }),
            ...(lampiranImages.length > 0 ? [
              new Paragraph({ text: "" }),
              new Paragraph({ children: [new TextRun({ text: "LAMPIRAN FOTO DOKUMENTASI", bold: true, underline: {} })], alignment: AlignmentType.CENTER }),
              new Paragraph({ text: "" }),
              ...lampiranImages.flatMap((img, i) => [
                new Paragraph({ children: [new ImageRun({ data: img.data, transformation: { width: img.width, height: img.height }, type: "jpg" })] }),
                new Paragraph({ children: [new TextRun(img.keterangan || `Foto ${i + 1}`)], alignment: AlignmentType.CENTER }),
                new Paragraph({ text: "" }),
              ]),
            ] : []),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Berita-Acara-${ba.nomorBA}.docx`;
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
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 h-screen bg-background border-l shadow-xl flex flex-col"
        style={{ width: "min(900px, 90vw)" }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background shrink-0">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose} className="gap-1.5">
              <ArrowLeft className="size-4" /> Tutup
            </Button>
            {ba && (() => {
              const baStatus = ba.status ?? "menunggu";
              const cfg = STATUS_CONFIG[baStatus];
              const Icon = cfg.icon;
              return (
                <span className={cn("hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border", cfg.className)}>
                  <Icon className="size-3" />
                  {cfg.label}
                </span>
              );
            })()}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handlePrintOrPdf} disabled={!ba}>
              <Printer className="size-4 mr-1.5" />
              <span className="hidden sm:inline">Cetak / Simpan PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDownloadWord} disabled={!ba || exporting}>
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
            {!ba ? (
              <div className="bg-white rounded shadow-sm p-10 space-y-4" style={{ width: "215mm" }}>
                <Skeleton className="h-6 w-48 mx-auto" />
                <Skeleton className="h-4 w-32 mx-auto" />
                <Skeleton className="h-40 w-full mt-4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="shadow-lg rounded overflow-hidden">
                <BeritaAcaraPreview ba={ba} />
              </div>
            )}
          </div>
        </div>

        {/* Panel review — hanya untuk supervisor ke atas dan BA masih menunggu */}
        {ba && canReview && baStatus === "menunggu" && (
          <BeritaAcaraReviewPanel baId={ba._id} onReviewed={onClose} />
        )}

        {/* Info status jika sudah direview */}
        {ba && baStatus !== "menunggu" && (
          <div className={cn(
            "border-t px-4 py-3 shrink-0 flex items-start gap-3",
            baStatus === "disetujui" ? "bg-green-50 dark:bg-green-900/10" : "bg-red-50 dark:bg-red-900/10"
          )}>
            {baStatus === "disetujui"
              ? <CheckCircle2 className="size-4 text-green-600 mt-0.5 shrink-0" />
              : <XCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
            }
            <div className="space-y-0.5">
              <p className={cn("text-[12px] font-semibold", baStatus === "disetujui" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                {baStatus === "disetujui" ? "Disetujui" : "Ditolak"} oleh {ba.reviewerNama ?? "—"}
              </p>
              {ba.catatanReview && (
                <p className="text-[11px] text-muted-foreground">{ba.catatanReview}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
