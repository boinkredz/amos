/**
 * Laporan Harian document preview — styled like the official printed form.
 * Used for screen preview only. Print/PDF uses a dedicated print window.
 */
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type CekFisikItem = {
  nama: string;
  jabatan: string;
  posRotasi: string;
  kondisiFisik: string;
  kelengkapanKerja: string;
  keterangan?: string;
};

type CekPeralatanItem = {
  namaAlat: string;
  jmlStandar: number;
  jmlTersedia: number;
  kondisi: string;
  keterangan?: string;
};

type LampiranItem = {
  storageId: string;
  keterangan: string;
  url: string | null;
};

export type LaporanHarianData = {
  tanggal: string;
  shift: string;
  namaPembuat: string;
  jabatanPembuat: string;
  namaAtasan?: string;
  jabatanAtasan?: string;
  lokasiGedung: string;
  personilHarusnya: number;
  personilHadir: number;
  statusKehadiran: "lengkap" | "tidak_lengkap";
  adaTerlambat: boolean;
  detailTerlambat?: string;
  adaAbsen: boolean;
  detailAbsen?: string;
  detailBackup?: string;
  cekFisik: CekFisikItem[];
  cekPeralatan: CekPeralatanItem[];
  adaDinamika: boolean;
  dinamika?: string;
  adaInfoRegu: boolean;
  detailInfoRegu?: string;
  adaEskalasi: boolean;
  detailEskalasi?: string;
  lampiran: LampiranItem[];
  site?: { nama: string } | null;
};

const cell = (content: React.ReactNode, style?: React.CSSProperties) => (
  <td style={{ border: "1px solid #000", padding: "3px 6px", verticalAlign: "middle", fontSize: "9pt", ...style }}>
    {content}
  </td>
);

const th = (content: React.ReactNode, style?: React.CSSProperties) => (
  <th style={{ border: "1px solid #000", padding: "3px 6px", backgroundColor: "#1a1a2e", color: "#fff", fontSize: "9pt", textAlign: "center", ...style }}>
    {content}
  </th>
);

export default function LaporanHarianPreview({ laporan }: { laporan: LaporanHarianData }) {
  const tanggalFormatted = format(new Date(laporan.tanggal), "EEEE, d MMMM yyyy", { locale: localeId });

  const dash = "—";
  const belumDiisi = <span style={{ color: "#999", fontStyle: "italic" }}>Belum diisi</span>;

  return (
    <div
      style={{
        fontFamily: "Times New Roman, serif",
        fontSize: "10pt",
        color: "#000",
        background: "#fff",
        width: "215mm",
        minHeight: "330mm",
        padding: "20mm 25mm 20mm 30mm",
        boxSizing: "border-box",
        lineHeight: "1.5",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #000", paddingBottom: "8px", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "44px", height: "44px", border: "2px solid #333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10pt", fontWeight: "bold" }}>◆</div>
          <div>
            <div style={{ fontWeight: "bold", fontSize: "14pt", letterSpacing: "3px" }}>SOLID</div>
            <div style={{ fontSize: "7pt", color: "#555", letterSpacing: "1px" }}>RISK &amp; CRISIS ADVISORY</div>
          </div>
        </div>
        {laporan.site?.nama && (
          <div style={{ textAlign: "right", fontSize: "10pt", fontWeight: "bold" }}>{laporan.site.nama}</div>
        )}
      </div>

      {/* ── Title ── */}
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div style={{ fontWeight: "bold", fontSize: "13pt", letterSpacing: "1px" }}>LAPORAN HARIAN PROJECT</div>
        <div style={{ fontSize: "9pt", letterSpacing: "1px" }}>PENGECEKAN KINERJA PENGAMANAN</div>
        <div style={{ borderBottom: "1px solid #000", marginTop: "4px" }} />
      </div>

      {/* ── Info shift ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
        <tbody>
          {[
            ["Hari / Tanggal", tanggalFormatted],
            ["Shift", laporan.shift],
            ["Dibuat Oleh", `${laporan.namaPembuat} — ${laporan.jabatanPembuat}`],
          ].map(([label, value]) => (
            <tr key={label}>
              <td style={{ width: "30%", padding: "1px 0" }}>{label}</td>
              <td style={{ width: "4%", padding: "1px 0" }}>:</td>
              <td style={{ padding: "1px 0" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── I. Jumlah Personil ── */}
      <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>I. JUMLAH PERSONIL</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
        <thead>
          <tr>{th("Keterangan", { textAlign: "left", width: "70%" })}{th("Jumlah")}</tr>
        </thead>
        <tbody>
          <tr>{cell("Personil seharusnya bertugas")}{cell(laporan.personilHarusnya, { textAlign: "center" })}</tr>
          <tr>{cell("Personil hadir")}{cell(laporan.personilHadir, { textAlign: "center" })}</tr>
          <tr>{cell("Status kehadiran")}{cell(laporan.statusKehadiran === "lengkap" ? "Lengkap" : "Tidak Lengkap", { textAlign: "center" })}</tr>
        </tbody>
      </table>

      {/* ── II. Keterlambatan ── */}
      <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>II. KETERLAMBATAN PERSONIL</div>
      <div style={{ marginBottom: "10px", fontSize: "9pt" }}>
        {laporan.adaTerlambat ? (laporan.detailTerlambat || belumDiisi) : dash}
      </div>

      {/* ── III. Absensi & Backup ── */}
      <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>III. ABSENSI PERSONIL &amp; BACK-UP</div>
      <div style={{ marginBottom: "10px", fontSize: "9pt" }}>
        {laporan.adaAbsen
          ? <>{laporan.detailAbsen || belumDiisi}{laporan.detailBackup && <div style={{ marginTop: "2px" }}>Backup: {laporan.detailBackup}</div>}</>
          : dash}
      </div>

      {/* ── IV. Cek Fisik ── */}
      <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>IV. PENGECEKAN KONDISI FISIK &amp; KELENGKAPAN KERJA PERSONIL</div>
      {laporan.cekFisik.length === 0 ? (
        <div style={{ marginBottom: "10px", fontSize: "9pt" }}>{dash}</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
          <thead>
            <tr>
              {th("#")}{th("Nama")}{th("Jabatan")}{th("Pos/Rotasi")}{th("Kondisi Fisik")}{th("Kelengkapan")}{th("Ket.")}
            </tr>
          </thead>
          <tbody>
            {laporan.cekFisik.map((item, i) => (
              <tr key={i}>
                {cell(i + 1, { textAlign: "center" })}
                {cell(item.nama)}
                {cell(item.jabatan)}
                {cell(item.posRotasi)}
                {cell(item.kondisiFisik, { textAlign: "center" })}
                {cell(item.kelengkapanKerja, { textAlign: "center" })}
                {cell(item.keterangan || dash, { textAlign: "center" })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── V. Cek Peralatan ── */}
      <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>V. PENGECEKAN PERALATAN &amp; PERLENGKAPAN KERJA</div>
      {laporan.cekPeralatan.length === 0 ? (
        <div style={{ marginBottom: "10px", fontSize: "9pt" }}>{dash}</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
          <thead>
            <tr>
              {th("#")}{th("Nama Peralatan")}{th("Std")}{th("Tersedia")}{th("Kondisi")}{th("Keterangan")}
            </tr>
          </thead>
          <tbody>
            {laporan.cekPeralatan.map((item, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f9f9f9" }}>
                {cell(i + 1, { textAlign: "center" })}
                {cell(item.namaAlat)}
                {cell(item.jmlStandar, { textAlign: "center" })}
                {cell(item.jmlTersedia, { textAlign: "center" })}
                {cell(item.kondisi, { textAlign: "center" })}
                {cell(item.keterangan || dash)}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── VI. Dinamika ── */}
      <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>VI. DINAMIKA / HAL MENONJOL</div>
      <div style={{ marginBottom: "10px", fontSize: "9pt" }}>
        {laporan.adaDinamika ? (laporan.dinamika || belumDiisi) : dash}
      </div>

      {/* ── VII. Info Regu ── */}
      <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>VII. INFORMASI UNTUK REGU BERIKUTNYA</div>
      <div style={{ marginBottom: "10px", fontSize: "9pt" }}>
        {laporan.adaInfoRegu ? (laporan.detailInfoRegu || belumDiisi) : dash}
      </div>

      {/* ── VIII. Eskalasi ── */}
      <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>VIII. HAL YANG PERLU DIESKALASI LEBIH LANJUT</div>
      <div style={{ marginBottom: "16px", fontSize: "9pt" }}>
        {laporan.adaEskalasi ? (laporan.detailEskalasi || belumDiisi) : dash}
      </div>

      {/* ── Place & date ── */}
      <div style={{ textAlign: "right", marginBottom: "20px" }}>
        {laporan.lokasiGedung}, {format(new Date(laporan.tanggal), "d MMMM yyyy", { locale: localeId })}
      </div>

      {/* ── Signatures ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
        <tbody>
          <tr>
            <td style={{ width: "50%", verticalAlign: "top", padding: "0 12px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "60px" }}>YANG MEMBUAT,</div>
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px", display: "inline-block", minWidth: "140px" }}>
                <div style={{ fontWeight: "bold" }}>{laporan.namaPembuat}</div>
                <div>{laporan.jabatanPembuat}</div>
              </div>
            </td>
            <td style={{ width: "50%", verticalAlign: "top", padding: "0 12px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "60px" }}>MENGETAHUI,</div>
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px", display: "inline-block", minWidth: "140px" }}>
                <div style={{ fontWeight: "bold" }}>{laporan.namaAtasan ?? "MANAJEMEN PENGGUNA JASA"}</div>
                {laporan.jabatanAtasan && <div>{laporan.jabatanAtasan}</div>}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Lampiran ── */}
      {laporan.lampiran.filter((l) => l.url).length > 0 && (
        <div style={{ marginTop: "28px" }}>
          <div style={{ borderTop: "1px dashed #999", marginBottom: "16px" }} />
          <div style={{ textAlign: "center", fontWeight: "bold", textDecoration: "underline", marginBottom: "16px", letterSpacing: "1px" }}>
            LAMPIRAN FOTO DOKUMENTASI
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            {laporan.lampiran.map((l, i) =>
              l.url ? (
                <div key={i} style={{ textAlign: "center" }}>
                  <img src={l.url} alt={l.keterangan || `Foto ${i + 1}`}
                    style={{ width: "240px", height: "160px", objectFit: "cover", border: "1px solid #ccc", display: "block" }} />
                  <div style={{ marginTop: "4px", fontSize: "9pt" }}>{l.keterangan || `Foto ${i + 1}`}</div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
