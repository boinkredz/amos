import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Master data jabatan — admin can CRUD */
export const masterJabatan = defineTable({
  nama: v.string(),
  aktif: v.boolean(),
}).index("by_aktif", ["aktif"]);

/** Master data lokasi gedung — admin can CRUD */
export const masterLokasiGedung = defineTable({
  nama: v.string(),
  aktif: v.boolean(),
}).index("by_aktif", ["aktif"]);
