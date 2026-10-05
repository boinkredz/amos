import { defineTable } from "convex/server";
import { v } from "convex/values";

// Singleton: global attendance & penalty rules (one row only)
export const aturanAbsensi = defineTable({
  toleransiTerlambatMenit: v.number(), // late if check-in > this many minutes after shift start
  dendaTerlambat: v.number(), // flat Rp per late occurrence
  dendaPulangCepat: v.number(), // flat Rp per early check-out occurrence
  updatedBy: v.id("users"),
});
