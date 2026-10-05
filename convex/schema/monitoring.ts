import { defineTable } from "convex/server";
import { v } from "convex/values";

// Required headcount per site + shift. Missing rows fall back to the default (10).
export const kebutuhanPersonel = defineTable({
  siteId: v.optional(v.id("sites")),
  shiftId: v.id("shifts"),
  jumlah: v.number(),
  updatedBy: v.id("users"),
}).index("by_shift", ["shiftId"]);
