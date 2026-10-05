/**
 * Berita Acara document preview — styled like an official F4 document.
 * Used for screen preview only. Print/PDF uses a dedicated print window.
 */
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { JENIS_INSIDEN_LABELS } from "../_lib/constants.ts";
import type { JenisInsiden } from "@/convex/schema/insiden";

type LampiranItem = {
  storageId: string;
  keterangan: string;
  url: string | null;
};

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

type Props = {
  ba: BeritaAcaraData;
};

export default function BeritaAcaraPreview({ ba }: Props) {
  const tanggalFormatted = format(new Date(ba.tanggal), "d MMMM yyyy", { locale: localeId });
  const jenisLabel = JENIS_INSIDEN_LABELS[ba.jenisInsiden as JenisInsiden] ?? ba.jenisInsiden;

  const toList = (text: string) =>
    text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <div
      style={{
        fontFamily: "Times New Roman, serif",
        fontSize: "12pt",
        color: "#000",
        background: "#fff",
        width: "215mm",
        minHeight: "330mm",
        padding: "20mm 25mm 20mm 30mm", // top right bottom left — standard F4 margins
        boxSizing: "border-box",
        lineHeight: "1.6",
      }}
    >
      {/* ── Header logos ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        {/* Left: SOLID logo text */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "40px", height: "40px", border: "2px solid #333",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "8pt", fontWeight: "bold",
          }}>
            ◆
          </div>
          <div>
            <div style={{ fontWeight: "bold", fontSize: "13pt", letterSpacing: "2px" }}>SOLID</div>
            <div style={{ fontSize: "7pt", color: "#555" }}>MAN &amp; DEVICE ADVISORY</div>
          </div>
        </div>
        {/* Right: client/site name */}
        <div style={{ textAlign: "right", fontSize: "9pt", color: "#444" }}>
          {ba.site?.nama ?? ""}
        </div>
      </div>

      {/* ── Title ── */}
      <div style={{ textAlign: "center", marginBottom: "4px" }}>
        <div style={{ fontWeight: "bold", fontSize: "13pt", letterSpacing: "1px" }}>BERITA ACARA</div>
        <div style={{ fontSize: "11pt" }}>NOMOR : {ba.nomorBA}</div>
      </div>

      {/* ── Opening paragraph ── */}
      <p style={{ marginTop: "14px", marginBottom: "10px", textAlign: "justify" }}>
        Pada hari ini {format(new Date(ba.tanggal), "EEEE", { locale: localeId })}, {tanggalFormatted},
        saya yang sedang melaksanakan tugas di bawah ini :
      </p>

      {/* ── Identity table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px" }}>
        <tbody>
          {[
            ["Nama", ba.petugasNama],
            ["Jabatan", ba.petugasJabatan],
          ].map(([label, value]) => (
            <tr key={label}>
              <td style={{ width: "30%", paddingBottom: "2px" }}>{label}</td>
              <td style={{ width: "4%", paddingBottom: "2px" }}>:</td>
              <td style={{ paddingBottom: "2px" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginBottom: "12px" }}>Melaporkan kejadian sebagai berikut :</p>

      {/* ── Section A: Informasi Awal ── */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "6px" }}>
          A. Informasi Awal :
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["Hari/Tanggal", format(new Date(ba.tanggal), "EEEE, d MMMM yyyy", { locale: localeId })],
              ["Pukul", `${ba.waktu} WIB`],
              ["Kejadian", jenisLabel],
              ["Lokasi", `${ba.lokasiGedung} — ${ba.lokasiDetail}`],
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={{ width: "30%", paddingBottom: "2px" }}>{label}</td>
                <td style={{ width: "4%", paddingBottom: "2px" }}>:</td>
                <td style={{ paddingBottom: "2px" }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section B: Kronologi ── */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>
          B. Kronologi Kejadian:
        </div>
        <ol style={{ margin: "0", paddingLeft: "20px" }}>
          {toList(ba.kronologi).map((item, i) => (
            <li key={i} style={{ marginBottom: "2px" }}>{item}</li>
          ))}
        </ol>
      </div>

      {/* ── Section C: Tindakan ── */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>
          C. Tindakan Yang Dilakukan:
        </div>
        <ol style={{ margin: "0", paddingLeft: "20px" }}>
          {toList(ba.tindakan).map((item, i) => (
            <li key={i} style={{ marginBottom: "2px" }}>{item}</li>
          ))}
        </ol>
      </div>

      {/* ── Section D: Hasil ── */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "4px" }}>
          D. Hasil Dari Tindakan Yang Telah Diambil:
        </div>
        <ol style={{ margin: "0", paddingLeft: "20px" }}>
          {toList(ba.hasilTindakan).map((item, i) => (
            <li key={i} style={{ marginBottom: "2px" }}>{item}</li>
          ))}
        </ol>
      </div>

      {/* ── Closing paragraph ── */}
      <p style={{ marginBottom: "20px", textAlign: "justify" }}>
        Demikian laporan yang dapat saya sampaikan sebagai bahan periksa Pimpinan. Terima kasih.
      </p>

      {/* ── Place & date (right aligned) ── */}
      <div style={{ textAlign: "right", marginBottom: "24px" }}>
        {ba.tempatTtd}, {tanggalFormatted}
      </div>

      {/* ── Signatures (3 columns) ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
        <tbody>
          <tr>
            <td style={{ width: "33%", verticalAlign: "top", paddingBottom: "4px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "60px" }}>YANG MEMBUAT</div>
              {ba.ttdPetugasUrl && (
                <img src={ba.ttdPetugasUrl} alt="TTD Petugas" style={{ height: "50px", marginBottom: "4px", display: "block", margin: "0 auto 4px" }} />
              )}
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px", display: "inline-block", minWidth: "120px" }}>
                <div style={{ fontWeight: "bold" }}>{ba.petugasNama}</div>
                <div>{ba.petugasJabatan}</div>
              </div>
            </td>
            <td style={{ width: "33%", verticalAlign: "top", paddingBottom: "4px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "60px" }}>DI PERIKSA</div>
              {ba.ttdAtasanUrl && (
                <img src={ba.ttdAtasanUrl} alt="TTD Atasan" style={{ height: "50px", marginBottom: "4px", display: "block", margin: "0 auto 4px" }} />
              )}
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px", display: "inline-block", minWidth: "120px" }}>
                <div style={{ fontWeight: "bold" }}>{ba.atasanNama ?? ""}</div>
                <div>{ba.atasanJabatan ?? ""}</div>
              </div>
            </td>
            <td style={{ width: "33%", verticalAlign: "top", paddingBottom: "4px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "60px" }}>DI KETAHUI</div>
              {ba.ttdKetahuiUrl && (
                <img src={ba.ttdKetahuiUrl} alt="TTD Ketahui" style={{ height: "50px", marginBottom: "4px", display: "block", margin: "0 auto 4px" }} />
              )}
              <div style={{ borderTop: "1px solid #000", paddingTop: "4px", display: "inline-block", minWidth: "120px" }}>
                <div style={{ fontWeight: "bold" }}>{ba.ketahuiNama ?? ""}</div>
                <div>{ba.ketahuiJabatan ?? ""}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Lampiran foto ── */}
      {ba.lampiran.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <div style={{ borderTop: "1px dashed #999", marginBottom: "20px" }} />
          <div style={{ textAlign: "center", fontWeight: "bold", textDecoration: "underline", marginBottom: "16px", letterSpacing: "1px" }}>
            LAMPIRAN FOTO DOKUMENTASI
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            {ba.lampiran.map((l, i) =>
              l.url ? (
                <div key={i} style={{ textAlign: "center" }}>
                  <img
                    src={l.url}
                    alt={l.keterangan || `Foto ${i + 1}`}
                    style={{ width: "240px", height: "160px", objectFit: "cover", border: "1px solid #ccc", display: "block" }}
                  />
                  <div style={{ marginTop: "4px", fontSize: "10pt" }}>
                    {l.keterangan || `Foto ${i + 1}`}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
