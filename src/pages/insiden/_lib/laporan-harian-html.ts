import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { LaporanHarianData } from "../_components/laporan-harian-preview.tsx";

function tableRow(cells: string[], isHeader = false): string {
  const tag = isHeader ? "th" : "td";
  const style = isHeader
    ? `border:1px solid #000;padding:3px 6px;background:#1a1a2e;color:#fff;font-size:9pt;text-align:center;`
    : `border:1px solid #000;padding:3px 6px;font-size:9pt;vertical-align:middle;`;
  return `<tr>${cells.map((c) => `<${tag} style="${style}">${c}</${tag}>`).join("")}</tr>`;
}

export function buildLaporanHarianHtml(laporan: LaporanHarianData): string {
  const tanggalFormatted = format(new Date(laporan.tanggal), "EEEE, d MMMM yyyy", { locale: localeId });
  const tanggalShort = format(new Date(laporan.tanggal), "d MMMM yyyy", { locale: localeId });
  const dash = "—";

  const cekFisikRows = laporan.cekFisik.length === 0
    ? `<p style="font-size:9pt;">${dash}</p>`
    : `<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead>${tableRow(["#","Nama","Jabatan","Pos/Rotasi","Kondisi Fisik","Kelengkapan","Ket."], true)}</thead>
        <tbody>${laporan.cekFisik.map((item, i) =>
          tableRow([String(i+1), item.nama, item.jabatan, item.posRotasi, item.kondisiFisik, item.kelengkapanKerja, item.keterangan || dash])
        ).join("")}</tbody>
       </table>`;

  const cekPeralatanRows = laporan.cekPeralatan.length === 0
    ? `<p style="font-size:9pt;">${dash}</p>`
    : `<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead>${tableRow(["#","Nama Peralatan","Std","Tersedia","Kondisi","Keterangan"], true)}</thead>
        <tbody>${laporan.cekPeralatan.map((item, i) =>
          `<tr style="background:${i%2===0?"#fff":"#f9f9f9"}">${[String(i+1),item.namaAlat,String(item.jmlStandar),String(item.jmlTersedia),item.kondisi,item.keterangan||dash].map(c=>`<td style="border:1px solid #000;padding:3px 6px;font-size:9pt;">${c}</td>`).join("")}</tr>`
        ).join("")}</tbody>
       </table>`;

  const lampiranHtml = laporan.lampiran.filter(l => l.url).map((l, i) => `
    <div style="display:inline-block;text-align:center;margin:0 12px 16px 0;page-break-inside:avoid;">
      <img src="${l.url}" alt="${l.keterangan || `Foto ${i+1}`}" style="width:240px;height:160px;object-fit:cover;border:1px solid #ccc;display:block;" />
      <div style="margin-top:4px;font-size:9pt;">${l.keterangan || `Foto ${i+1}`}</div>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Laporan Harian — ${tanggalFormatted}</title>
  <style>
    @page { size: 215mm 330mm; margin: 20mm 25mm 20mm 30mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, serif; font-size: 10pt; color: #000; background: #fff; line-height: 1.5; }
    .sec { font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
    .val { margin-bottom: 10px; font-size: 9pt; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } img { page-break-inside: avoid; } }
  </style>
</head>
<body>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:8px;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:44px;height:44px;border:2px solid #333;display:flex;align-items:center;justify-content:center;font-size:10pt;font-weight:bold;">◆</div>
      <div>
        <div style="font-weight:bold;font-size:14pt;letter-spacing:3px;">SOLID</div>
        <div style="font-size:7pt;color:#555;letter-spacing:1px;">RISK &amp; CRISIS ADVISORY</div>
      </div>
    </div>
    ${laporan.site?.nama ? `<div style="text-align:right;font-size:10pt;font-weight:bold;">${laporan.site.nama}</div>` : ""}
  </div>

  <!-- Title -->
  <div style="text-align:center;margin-bottom:8px;">
    <div style="font-weight:bold;font-size:13pt;letter-spacing:1px;">LAPORAN HARIAN PROJECT</div>
    <div style="font-size:9pt;letter-spacing:1px;">PENGECEKAN KINERJA PENGAMANAN</div>
    <div style="border-bottom:1px solid #000;margin-top:4px;"></div>
  </div>

  <!-- Info shift -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
    <tr><td style="width:30%;padding:1px 0;">Hari / Tanggal</td><td style="width:4%;padding:1px 0;">:</td><td style="padding:1px 0;">${tanggalFormatted}</td></tr>
    <tr><td style="padding:1px 0;">Shift</td><td style="padding:1px 0;">:</td><td style="padding:1px 0;">${laporan.shift}</td></tr>
    <tr><td style="padding:1px 0;">Dibuat Oleh</td><td style="padding:1px 0;">:</td><td style="padding:1px 0;">${laporan.namaPembuat} — ${laporan.jabatanPembuat}</td></tr>
  </table>

  <div class="sec">I. JUMLAH PERSONIL</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
    <thead><tr>
      <th style="border:1px solid #000;padding:3px 6px;background:#1a1a2e;color:#fff;font-size:9pt;text-align:left;width:70%;">Keterangan</th>
      <th style="border:1px solid #000;padding:3px 6px;background:#1a1a2e;color:#fff;font-size:9pt;">Jumlah</th>
    </tr></thead>
    <tbody>
      <tr><td style="border:1px solid #000;padding:3px 6px;font-size:9pt;">Personil seharusnya bertugas</td><td style="border:1px solid #000;padding:3px 6px;font-size:9pt;text-align:center;">${laporan.personilHarusnya}</td></tr>
      <tr><td style="border:1px solid #000;padding:3px 6px;font-size:9pt;">Personil hadir</td><td style="border:1px solid #000;padding:3px 6px;font-size:9pt;text-align:center;">${laporan.personilHadir}</td></tr>
      <tr><td style="border:1px solid #000;padding:3px 6px;font-size:9pt;">Status kehadiran</td><td style="border:1px solid #000;padding:3px 6px;font-size:9pt;text-align:center;">${laporan.statusKehadiran === "lengkap" ? "Lengkap" : "Tidak Lengkap"}</td></tr>
    </tbody>
  </table>

  <div class="sec">II. KETERLAMBATAN PERSONIL</div>
  <div class="val">${laporan.adaTerlambat ? (laporan.detailTerlambat || "<i>Belum diisi</i>") : dash}</div>

  <div class="sec">III. ABSENSI PERSONIL &amp; BACK-UP</div>
  <div class="val">${laporan.adaAbsen ? ((laporan.detailAbsen || "<i>Belum diisi</i>") + (laporan.detailBackup ? `<br/>Backup: ${laporan.detailBackup}` : "")) : dash}</div>

  <div class="sec">IV. PENGECEKAN KONDISI FISIK &amp; KELENGKAPAN KERJA PERSONIL</div>
  ${cekFisikRows}

  <div class="sec">V. PENGECEKAN PERALATAN &amp; PERLENGKAPAN KERJA</div>
  ${cekPeralatanRows}

  <div class="sec">VI. DINAMIKA / HAL MENONJOL</div>
  <div class="val">${laporan.adaDinamika ? (laporan.dinamika || "<i>Belum diisi</i>") : dash}</div>

  <div class="sec">VII. INFORMASI UNTUK REGU BERIKUTNYA</div>
  <div class="val">${laporan.adaInfoRegu ? (laporan.detailInfoRegu || "<i>Belum diisi</i>") : dash}</div>

  <div class="sec">VIII. HAL YANG PERLU DIESKALASI LEBIH LANJUT</div>
  <div class="val">${laporan.adaEskalasi ? (laporan.detailEskalasi || "<i>Belum diisi</i>") : dash}</div>

  <!-- Place & date -->
  <div style="text-align:right;margin-bottom:20px;">${laporan.lokasiGedung}, ${tanggalShort}</div>

  <!-- Signatures -->
  <table style="width:100%;border-collapse:collapse;text-align:center;">
    <tr>
      <td style="width:50%;vertical-align:top;padding:0 12px;">
        <div style="font-weight:bold;margin-bottom:60px;">YANG MEMBUAT,</div>
        <div style="border-top:1px solid #000;padding-top:4px;display:inline-block;min-width:140px;">
          <div style="font-weight:bold;">${laporan.namaPembuat}</div>
          <div>${laporan.jabatanPembuat}</div>
        </div>
      </td>
      <td style="width:50%;vertical-align:top;padding:0 12px;">
        <div style="font-weight:bold;margin-bottom:60px;">MENGETAHUI,</div>
        <div style="border-top:1px solid #000;padding-top:4px;display:inline-block;min-width:140px;">
          <div style="font-weight:bold;">${laporan.namaAtasan ?? "MANAJEMEN PENGGUNA JASA"}</div>
          ${laporan.jabatanAtasan ? `<div>${laporan.jabatanAtasan}</div>` : ""}
        </div>
      </td>
    </tr>
  </table>

  ${lampiranHtml ? `
  <hr style="border:none;border-top:1px dashed #999;margin:24px 0;"/>
  <p style="text-align:center;font-weight:bold;text-decoration:underline;letter-spacing:1px;margin-bottom:16px;">LAMPIRAN FOTO DOKUMENTASI</p>
  <div>${lampiranHtml}</div>` : ""}

</body>
</html>`;
}
