import { defineTable } from "convex/server";
import { v } from "convex/values";

export const kondisiValidator = v.union(
  v.literal("baik"),
  v.literal("rusak"),
  v.literal("hilang"),
);

export const kategoriValidator = v.union(
  v.literal("komunikasi"),
  v.literal("keamanan"),
  v.literal("APD"),
  v.literal("kendaraan"),
  v.literal("lainnya"),
);

export const masterPerlengkapan = defineTable({
  nama: v.string(),
  kategori: kategoriValidator,
  jumlahStandar: v.number(),
  siteId: v.id("sites"),
  aktif: v.boolean(),
  keterangan: v.optional(v.string()),
}).index("by_site", ["siteId"]);

export const cekPerlengkapanItem = v.object({
  perlengkapanId: v.id("masterPerlengkapan"),
  kondisi: kondisiValidator,
  jumlahTersedia: v.number(),
  keterangan: v.optional(v.string()),
  foto: v.optional(v.string()),
});

export const cekPerlengkapan = defineTable({
  officerId: v.id("officers"),
  shiftAssignmentId: v.id("shiftAssignments"),
  siteId: v.id("sites"),
  tanggal: v.string(), // YYYY-MM-DD
  items: v.array(cekPerlengkapanItem),
  waktuCek: v.string(), // ISO 8601 UTC
})
  .index("by_site_date", ["siteId", "tanggal"])
  .index("by_assignment", ["shiftAssignmentId"])
  .index("by_officer_date", ["officerId", "tanggal"]);

export const tindakLanjutStatusValidator = v.union(
  v.literal("open"),
  v.literal("sedang_diperbaiki"),
  v.literal("perlu_diganti"),
  v.literal("sudah_ditemukan"),
  v.literal("lapor_kehilangan"),
  v.literal("selesai"),
);

export const tindakLanjut = defineTable({
  perlengkapanId: v.id("masterPerlengkapan"),
  siteId: v.id("sites"),
  jenis: v.union(v.literal("rusak"), v.literal("hilang")),
  status: tindakLanjutStatusValidator,
  catatan: v.optional(v.string()),
  updatedBy: v.id("users"),
  cekPerlengkapanId: v.optional(v.id("cekPerlengkapan")),
})
  .index("by_site_status", ["siteId", "status"])
  .index("by_perlengkapan", ["perlengkapanId"]);

export const serahTerimaStatusValidator = v.union(
  v.literal("menunggu"),
  v.literal("selesai"),
  v.literal("ada_masalah"),
);

export const serahTerima = defineTable({
  siteId: v.id("sites"),
  tanggal: v.string(), // YYYY-MM-DD
  shiftKeluarAssignmentId: v.id("shiftAssignments"),
  shiftMasukAssignmentId: v.optional(v.id("shiftAssignments")),
  cekPerlengkapan: v.array(
    v.object({
      perlengkapanId: v.id("masterPerlengkapan"),
      kondisi: kondisiValidator,
      jumlahTersedia: v.number(),
      keterangan: v.optional(v.string()),
    }),
  ),
  catatanKejadian: v.string(),
  konfirmasiMasuk: v.boolean(),
  catatanMasuk: v.optional(v.string()),
  waktuSerah: v.string(), // ISO 8601 UTC
  waktuKonfirmasi: v.optional(v.string()), // ISO 8601 UTC
  status: serahTerimaStatusValidator,
})
  .index("by_site_date", ["siteId", "tanggal"])
  .index("by_status", ["status"])
  .index("by_shift_keluar", ["shiftKeluarAssignmentId"]);
