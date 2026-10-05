import { defineTable } from "convex/server";
import { v } from "convex/values";

export const regu = defineTable({
  nama: v.string(), // "NON SHIFT", "REGU 1", "REGU 2", dst (dinamis)
  danruId: v.optional(v.id("officers")),
  wadanruId: v.optional(v.id("officers")),
  actingDanruId: v.optional(v.id("officers")), // wadanru yg sedang acting
  isNonShift: v.boolean(), // true untuk regu NON SHIFT
  aktif: v.boolean(),
  tanggalMulaiRotasi: v.optional(v.string()), // YYYY-MM-DD
}).index("by_aktif", ["aktif"]);
