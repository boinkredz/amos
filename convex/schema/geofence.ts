import { defineTable } from "convex/server";
import { v } from "convex/values";

// One geo fence zone per site (radius-based)
export const geoFence = defineTable({
  siteId: v.id("sites"),
  nama: v.string(), // nama zona, e.g. "Zona Utama"
  lat: v.number(), // pusat latitude
  lng: v.number(), // pusat longitude
  radius: v.number(), // radius dalam meter
  keterangan: v.optional(v.string()),
  aktif: v.boolean(),
})
  .index("by_site", ["siteId"])
  .index("by_site_aktif", ["siteId", "aktif"]);
