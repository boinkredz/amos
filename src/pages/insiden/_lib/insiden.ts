import type { Id } from "@/convex/_generated/dataModel.js";

// ─── Jenis Insiden ──────────────────────────────────────────────────────────

export const JENIS_INSIDEN_VALUES = [
  "kehilangan",
  "maintenance",
  "kerusakan_pengunjung",
  "pelanggaran_peraturan",
  "pelanggaran_anggota",
  "pencurian",
  "kebakaran",
  "kerusakan_fasilitas",
  "gangguan_ketertiban",
  "kecelakaan",
  "akses_tidak_sah",
  "gangguan_teknis",
  "lainnya",
] as const;

export type JenisInsiden = (typeof JENIS_INSIDEN_VALUES)[number];

export const JENIS_INSIDEN_LABELS: Record<JenisInsiden, string> = {
  kehilangan: "Kehilangan",
  maintenance: "Maintenance",
  kerusakan_pengunjung: "Kerusakan oleh Pengunjung",
  pelanggaran_peraturan: "Pelanggaran Peraturan",
  pelanggaran_anggota: "Pelanggaran Anggota",
  pencurian: "Pencurian",
  kebakaran: "Kebakaran",
  kerusakan_fasilitas: "Kerusakan Fasilitas",
  gangguan_ketertiban: "Gangguan Ketertiban",
  kecelakaan: "Kecelakaan",
  akses_tidak_sah: "Akses Tidak Sah",
  gangguan_teknis: "Gangguan Teknis",
  lainnya: "Lainnya",
};

export type Severity = "tinggi" | "sedang" | "rendah";

/** Severity level per jenis insiden, used for badge coloring. */
export const JENIS_INSIDEN_SEVERITY: Record<JenisInsiden, Severity> = {
  pencurian: "tinggi",
  kebakaran: "tinggi",
  kecelakaan: "tinggi",
  akses_tidak_sah: "tinggi",
  kerusakan_pengunjung: "sedang",
  pelanggaran_peraturan: "sedang",
  pelanggaran_anggota: "sedang",
  gangguan_ketertiban: "sedang",
  kerusakan_fasilitas: "sedang",
  gangguan_teknis: "sedang",
  kehilangan: "rendah",
  maintenance: "rendah",
  lainnya: "rendah",
};

export const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  tinggi: "bg-destructive text-white",
  sedang: "bg-amber-500 text-white",
  rendah: "bg-sky-600 text-white",
};

export function jenisBadgeClass(jenis: JenisInsiden): string {
  return SEVERITY_BADGE_CLASS[JENIS_INSIDEN_SEVERITY[jenis]];
}

export const JENIS_INSIDEN_OPTIONS: Array<{ value: JenisInsiden; label: string }> =
  JENIS_INSIDEN_VALUES.map((value) => ({
    value,
    label: JENIS_INSIDEN_LABELS[value],
  }));

// ─── Shift ──────────────────────────────────────────────────────────────────

export const SHIFT_OPTIONS = ["Pagi", "Siang", "Malam"] as const;

// ─── Shared row types ─────────────────────────────────────────────────────────

export type LampiranWithUrl = {
  storageId: Id<"_storage">;
  keterangan: string;
  url: string | null;
};

export type SiteRef = { _id: Id<"sites">; nama: string } | null;

export type BeritaAcaraRow = {
  _id: Id<"beritaAcara">;
  _creationTime: number;
  nomorBA: string;
  siteId?: Id<"sites">;
  lokasiGedung: string;
  tanggal: string;
  waktu: string;
  jenisInsiden: JenisInsiden;
  lokasiDetail: string;
  kronologi: string;
  tindakan: string;
  hasilTindakan: string;
  petugasNama: string;
  petugasJabatan: string;
  atasanNama?: string;
  atasanJabatan?: string;
  ketahuiNama?: string;
  ketahuiJabatan?: string;
  tempatTtd: string;
  lampiran: LampiranWithUrl[];
  createdBy: Id<"users">;
  site: SiteRef;
};

export type CekFisikItem = {
  nama: string;
  jabatan: string;
  posRotasi: string;
  kondisiFisik: string;
  kelengkapanKerja: string;
  keterangan?: string;
};

export type CekPeralatanItem = {
  namaAlat: string;
  jmlStandar: number;
  jmlTersedia: number;
  kondisi: string;
  keterangan?: string;
};

export type LaporanHarianRow = {
  _id: Id<"laporanHarian">;
  _creationTime: number;
  siteId?: Id<"sites">;
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
  lampiran: LampiranWithUrl[];
  createdBy: Id<"users">;
  site: SiteRef;
};

export type SiteOption = {
  _id: Id<"sites">;
  nama: string;
  kode: string;
};

/** Format an ISO date string (yyyy-MM-dd) safely at local noon to avoid TZ shift. */
export function toLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}
