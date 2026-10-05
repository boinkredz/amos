import { defineTable } from "convex/server";
import { v } from "convex/values";

export const JENIS_INSIDEN = [
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

export type JenisInsiden = (typeof JENIS_INSIDEN)[number];

export const jenisInsidenValidator = v.union(
  v.literal("kehilangan"),
  v.literal("maintenance"),
  v.literal("kerusakan_pengunjung"),
  v.literal("pelanggaran_peraturan"),
  v.literal("pelanggaran_anggota"),
  v.literal("pencurian"),
  v.literal("kebakaran"),
  v.literal("kerusakan_fasilitas"),
  v.literal("gangguan_ketertiban"),
  v.literal("kecelakaan"),
  v.literal("akses_tidak_sah"),
  v.literal("gangguan_teknis"),
  v.literal("lainnya"),
);

export const lampiranValidator = v.object({
  storageId: v.id("_storage"),
  keterangan: v.string(),
});

export const ttdValidator = v.object({
  storageId: v.id("_storage"),
});

export const BA_STATUS = ["menunggu", "disetujui", "ditolak"] as const;
export type BaStatus = (typeof BA_STATUS)[number];

export const baStatusValidator = v.union(
  v.literal("menunggu"),
  v.literal("disetujui"),
  v.literal("ditolak"),
);

export const beritaAcara = defineTable({
  nomorBA: v.string(),
  siteId: v.optional(v.id("sites")),
  lokasiGedung: v.string(),
  tanggal: v.string(),
  waktu: v.string(),
  jenisInsiden: jenisInsidenValidator,
  lokasiDetail: v.string(),
  kronologi: v.string(),
  tindakan: v.string(),
  hasilTindakan: v.string(),
  // Pelapor otomatis dari user login
  petugasNama: v.string(),
  petugasJabatan: v.string(),
  lampiran: v.array(lampiranValidator),
  createdBy: v.id("users"),
  // Alur persetujuan
  status: v.optional(baStatusValidator),
  reviewedBy: v.optional(v.id("users")),
  reviewedAt: v.optional(v.string()),
  catatanReview: v.optional(v.string()),
  // Legacy fields (data lama sebelum redesign — tidak digunakan lagi)
  tempatTtd: v.optional(v.string()),
  atasanNama: v.optional(v.string()),
  atasanJabatan: v.optional(v.string()),
  ketahuiNama: v.optional(v.string()),
  ketahuiJabatan: v.optional(v.string()),
  ttdPetugas: v.optional(ttdValidator),
  ttdAtasan: v.optional(ttdValidator),
  ttdKetahui: v.optional(ttdValidator),
})
  .index("by_site", ["siteId"])
  .index("by_created", ["createdBy"])
  .index("by_status", ["status"]);

export const cekFisikItemValidator = v.object({
  nama: v.string(),
  jabatan: v.string(),
  posRotasi: v.string(),
  kondisiFisik: v.string(),
  kelengkapanKerja: v.string(),
  keterangan: v.optional(v.string()),
});

export const cekPeralatanItemValidator = v.object({
  namaAlat: v.string(),
  jmlStandar: v.number(),
  jmlTersedia: v.number(),
  kondisi: v.string(),
  keterangan: v.optional(v.string()),
});

export const laporanHarian = defineTable({
  siteId: v.optional(v.id("sites")),
  tanggal: v.string(),
  shift: v.string(),
  namaPembuat: v.string(),
  jabatanPembuat: v.string(),
  namaAtasan: v.optional(v.string()),
  jabatanAtasan: v.optional(v.string()),
  lokasiGedung: v.string(),
  personilHarusnya: v.number(),
  personilHadir: v.number(),
  statusKehadiran: v.union(v.literal("lengkap"), v.literal("tidak_lengkap")),
  adaTerlambat: v.boolean(),
  detailTerlambat: v.optional(v.string()),
  adaAbsen: v.boolean(),
  detailAbsen: v.optional(v.string()),
  detailBackup: v.optional(v.string()),
  cekFisik: v.array(cekFisikItemValidator),
  cekPeralatan: v.array(cekPeralatanItemValidator),
  adaDinamika: v.boolean(),
  dinamika: v.optional(v.string()),
  adaInfoRegu: v.boolean(),
  detailInfoRegu: v.optional(v.string()),
  adaEskalasi: v.boolean(),
  detailEskalasi: v.optional(v.string()),
  lampiran: v.array(lampiranValidator),
  createdBy: v.id("users"),
})
  .index("by_site", ["siteId"])
  .index("by_created", ["createdBy"])
  .index("by_tanggal", ["tanggal"]);

export const baCounter = defineTable({
  counter: v.number(),
});
