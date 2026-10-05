import { defineTable } from "convex/server";
import { v } from "convex/values";

export const deviceRegistrations = defineTable({
  userId: v.id("users"),
  deviceFingerprint: v.string(),
  deviceInfo: v.string(),
  registeredAt: v.string(),
  aktif: v.boolean(),
})
  .index("by_user", ["userId"])
  .index("by_fingerprint", ["deviceFingerprint"]);
