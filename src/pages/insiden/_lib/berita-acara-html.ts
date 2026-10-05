/**
 * Builds a standalone HTML string for Berita Acara — opened in a new window
 * for Cetak (print) or Save as PDF via the browser's print dialog.
 * F4 paper: 215mm × 330mm, margins: top/bottom 20mm, right 25mm, left 30mm.
 */
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { JENIS_INSIDEN_LABELS } from "./constants.ts";
import type { JenisInsiden } from "@/convex/schema/insiden";

type LampiranItem = { storageId: string; keterangan: string; url: string | null };

type BeritaAcaraData = {
  nomorBA: string;
  tanggal: string;
  waktu: string;
  jenisInsiden: string;
  lokasiGedung: string;
  lokasiDetail: string;
  kronologi: string;
  tindakan: string;
  hasilTindakan: string;
  petugasNama: string;
  petugasJabatan: string;
  ttdPetugasUrl?: string | null;
  atasanNama?: string;
  atasanJabatan?: string;
  ttdAtasanUrl?: string | null;
  ketahuiNama?: string;
  ketahuiJabatan?: string;
  ttdKetahuiUrl?: string | null;
  tempatTtd?: string;
  lampiran: LampiranItem[];
  site?: { nama: string } | null;
};

function toListHtml(text: string): string {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => `<li>${i + 1}. ${s}</li>`)
    .join("\n");
}

function ttdCell(title: string, ttdUrl: string | null | undefined, nama: string, jabatan: string): string {
  return `
    <td style="width:33%;text-align:center;vertical-align:top;padding:0 8px;">
      <div style="font-weight:bold;margin-bottom:60px;">${title}</div>
      ${ttdUrl ? `<img src="${ttdUrl}" alt="TTD" style="height:50px;display:block;margin:0 auto 4px;" />` : "<div style='height:54px;'></div>"}
      <div style="border-top:1px solid #000;padding-top:4px;display:inline-block;min-width:120px;">
        <div style="font-weight:bold;">${nama}</div>
        <div>${jabatan}</div>
      </div>
    </td>`;
}

export function buildBeritaAcaraHtml(ba: BeritaAcaraData): string {
  const tanggalFormatted = format(new Date(ba.tanggal), "d MMMM yyyy", { locale: localeId });
  const hariFormatted = format(new Date(ba.tanggal), "EEEE", { locale: localeId });
  const tanggalLengkap = format(new Date(ba.tanggal), "EEEE, d MMMM yyyy", { locale: localeId });
  const jenisLabel = JENIS_INSIDEN_LABELS[ba.jenisInsiden as JenisInsiden] ?? ba.jenisInsiden;

  const lampiranHtml = ba.lampiran
    .filter((l) => l.url)
    .map(
      (l, i) => `
        <div style="display:inline-block;text-align:center;margin:0 12px 16px 0;page-break-inside:avoid;">
          <img src="${l.url}" alt="${l.keterangan || `Foto ${i + 1}`}"
               style="width:240px;height:160px;object-fit:cover;border:1px solid #ccc;display:block;" />
          <div style="margin-top:4px;font-size:10pt;">${l.keterangan || `Foto ${i + 1}`}</div>
        </div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Berita Acara ${ba.nomorBA}</title>
  <style>
    @page {
      size: 215mm 330mm;
      margin: 20mm 25mm 20mm 30mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      color: #000;
      background: #fff;
      line-height: 1.6;
    }
    h1 { font-size: 13pt; text-align: center; letter-spacing: 1px; margin-bottom: 2px; }
    .center { text-align: center; }
    .right { text-align: right; }
    .justify { text-align: justify; }
    .bold { font-weight: bold; }
    .underline { text-decoration: underline; }
    .mb-4 { margin-bottom: 4px; }
    .mb-8 { margin-bottom: 8px; }
    .mb-12 { margin-bottom: 12px; }
    .mb-16 { margin-bottom: 16px; }
    .mt-16 { margin-top: 16px; }
    .mt-24 { margin-top: 24px; }
    .mt-32 { margin-top: 32px; }
    table.info { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    table.info td { padding: 1px 0; vertical-align: top; }
    table.info td:first-child { width: 30%; }
    table.info td:nth-child(2) { width: 4%; }
    ol { margin: 0; padding-left: 20px; list-style: none; }
    ol li { margin-bottom: 2px; }
    .section-title { font-weight: bold; text-decoration: underline; margin-bottom: 6px; }
    .dashed-hr { border: none; border-top: 1px dashed #999; margin: 24px 0; }
    .lampiran-grid { margin-top: 8px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      img { page-break-inside: avoid; }
      .lampiran-item { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- Header logos -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="width:40px;height:40px;border:2px solid #333;display:flex;align-items:center;justify-content:center;font-size:14pt;">◆</div>
      <div>
        <div style="font-weight:bold;font-size:13pt;letter-spacing:2px;">SOLID</div>
        <div style="font-size:7pt;color:#555;">MAN &amp; DEVICE ADVISORY</div>
      </div>
    </div>
    <div style="text-align:right;font-size:9pt;color:#444;">${ba.site?.nama ?? ""}</div>
  </div>

  <!-- Title -->
  <h1>BERITA ACARA</h1>
  <p class="center mb-12">NOMOR : ${ba.nomorBA}</p>

  <!-- Opening -->
  <p class="justify mt-16 mb-12">
    Pada hari ini ${hariFormatted}, ${tanggalFormatted}, saya yang sedang melaksanakan tugas di bawah ini :
  </p>

  <!-- Identity -->
  <table class="info">
    <tr><td>Nama</td><td>:</td><td>${ba.petugasNama}</td></tr>
    <tr><td>Jabatan</td><td>:</td><td>${ba.petugasJabatan}</td></tr>
  </table>

  <p class="mb-12">Melaporkan kejadian sebagai berikut :</p>

  <!-- A. Informasi Awal -->
  <div class="section-title">A. Informasi Awal :</div>
  <table class="info mb-12">
    <tr><td>Hari/Tanggal</td><td>:</td><td>${tanggalLengkap}</td></tr>
    <tr><td>Pukul</td><td>:</td><td>${ba.waktu} WIB</td></tr>
    <tr><td>Kejadian</td><td>:</td><td>${jenisLabel}</td></tr>
    <tr><td>Lokasi</td><td>:</td><td>${ba.lokasiGedung} — ${ba.lokasiDetail}</td></tr>
  </table>

  <!-- B. Kronologi -->
  <div class="section-title">B. Kronologi Kejadian:</div>
  <ol class="mb-12">${toListHtml(ba.kronologi)}</ol>

  <!-- C. Tindakan -->
  <div class="section-title">C. Tindakan Yang Dilakukan:</div>
  <ol class="mb-12">${toListHtml(ba.tindakan)}</ol>

  <!-- D. Hasil -->
  <div class="section-title">D. Hasil Dari Tindakan Yang Telah Diambil:</div>
  <ol class="mb-16">${toListHtml(ba.hasilTindakan)}</ol>

  <!-- Closing -->
  <p class="justify mb-16">
    Demikian laporan yang dapat saya sampaikan sebagai bahan periksa Pimpinan. Terima kasih.
  </p>

  <!-- Place & date -->
  <p class="right mb-24">${ba.tempatTtd}, ${tanggalFormatted}</p>

  <!-- Signatures -->
  <table style="width:100%;border-collapse:collapse;text-align:center;">
    <tr>
      ${ttdCell("YANG MEMBUAT", ba.ttdPetugasUrl, ba.petugasNama, ba.petugasJabatan)}
      ${ttdCell("DI PERIKSA", ba.ttdAtasanUrl, ba.atasanNama ?? "", ba.atasanJabatan ?? "")}
      ${ttdCell("DI KETAHUI", ba.ttdKetahuiUrl, ba.ketahuiNama ?? "", ba.ketahuiJabatan ?? "")}
    </tr>
  </table>

  <!-- Lampiran -->
  ${
    lampiranHtml
      ? `<hr class="dashed-hr" />
         <p style="text-align:center;font-weight:bold;text-decoration:underline;letter-spacing:1px;margin-bottom:16px;">LAMPIRAN FOTO DOKUMENTASI</p>
         <div class="lampiran-grid">${lampiranHtml}</div>`
      : ""
  }

</body>
</html>`;
}
