import { defineTable } from "convex/server";
import { v } from "convex/values";

export const sites = defineTable({
  nama: v.string(),
  kode: v.string(), // short code e.g. "GDA", "PKN"
  alamat: v.string(),
  kota: v.optional(v.string()),
  koordinat: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  keterangan: v.optional(v.string()),
  aktif: v.boolean(),
})
  .index("by_kode", ["kode"])
  .index("by_aktif", ["aktif"]);

// Junction: assign officer to a site
export const siteOfficers = defineTable({
  siteId: v.id("sites"),
  officerId: v.id("officers"),
  tanggalMulai: v.string(), // ISO date "YYYY-MM-DD"
  tanggalSelesai: v.optional(v.string()),
  aktif: v.boolean(),
})
  .index("by_site", ["siteId"])
  .index("by_officer", ["officerId"])
  .index("by_site_aktif", ["siteId", "aktif"]);
