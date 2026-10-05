import { defineTable } from "convex/server";
import { v } from "convex/values";

// Per-officer salary components
export const gajiKomponen = defineTable({
  officerId: v.id("officers"),
  gajiPokok: v.number(),
  tunjangan: v.number(),       // fixed monthly allowance
  bonusBackup: v.number(),     // per backup-shift bonus
  dendaPerMenit: v.number(),   // late deduction per minute
  bpjsPersen: v.number(),      // BPJS percentage (0-100)
  pajakPersen: v.number(),     // tax percentage (0-100)
  updatedBy: v.id("users"),
}).index("by_officer", ["officerId"]);

// Cash advance / loan
export const kasbon = defineTable({
  officerId: v.id("officers"),
  jumlah: v.number(),
  sisa: v.number(),
  cicilanPerBulan: v.number(),
  tanggalPinjam: v.string(),   // ISO date
  keterangan: v.optional(v.string()),
  status: v.union(v.literal("aktif"), v.literal("lunas")),
  dicatatOleh: v.id("users"),
}).index("by_officer", ["officerId"])
  .index("by_officer_status", ["officerId", "status"]);

// General ledger entries (debit / credit)
export const transaksiKeuangan = defineTable({
  officerId: v.id("officers"),
  tanggal: v.string(),         // ISO date
  tipe: v.union(v.literal("pemasukan"), v.literal("pengeluaran")),
  kategori: v.string(),        // e.g. "gaji_pokok", "tunjangan", "cicilan_kasbon", "denda", "manual"
  jumlah: v.number(),
  keterangan: v.optional(v.string()),
  periode: v.string(),         // "YYYY-MM" for grouping
  kasbonId: v.optional(v.id("kasbon")),
  dicatatOleh: v.id("users"),
}).index("by_officer_periode", ["officerId", "periode"])
  .index("by_periode", ["periode"]);

// Monthly payroll summary
export const rekapGaji = defineTable({
  officerId: v.id("officers"),
  periode: v.string(),         // "YYYY-MM"
  totalPemasukan: v.number(),
  totalPotongan: v.number(),
  gajiBersih: v.number(),
  status: v.union(v.literal("draft"), v.literal("final")),
  breakdown: v.object({
    gajiPokok: v.number(),
    tunjangan: v.number(),
    bonusBackup: v.number(),
    jumlahBackup: v.number(),
    dendaTerlambat: v.number(),
    menitTerlambat: v.number(),
    jumlahTerlambat: v.optional(v.number()),
    dendaPulangCepat: v.optional(v.number()),
    jumlahPulangCepat: v.optional(v.number()),
    cicilanKasbon: v.number(),
    bpjs: v.number(),
    pajak: v.number(),
    potonganManual: v.number(),
    tambahanManual: v.number(),
  }),
  difinalisasiOleh: v.optional(v.id("users")),
  difinalisasiAt: v.optional(v.string()),
}).index("by_officer_periode", ["officerId", "periode"])
  .index("by_periode", ["periode"])
  .index("by_officer", ["officerId"]);
