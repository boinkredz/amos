import { defineTable } from "convex/server";
import { v } from "convex/values";

// Push notification identity mapping (subscription secret -> visitorId)
export const pushIdentities = defineTable({
  secret: v.string(),
  visitorId: v.string(),
})
  .index("by_secret", ["secret"])
  .index("by_visitorId", ["visitorId"]);
