"use node";

import { Hercules } from "@usehercules/sdk";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

const hercules = new Hercules({ apiKey: process.env.HERCULES_API_KEY!, apiVersion: "2025-12-09" });

type SubscribeParams = Parameters<typeof hercules.pushNotifications.subscribe>[0];

export const getVapidPublicKey = action({
  args: {},
  handler: async (): Promise<{ vapidPublicKey: string }> => {
    try {
      const { vapidPublicKey } = await hercules.pushNotifications.enable();
      return { vapidPublicKey };
    } catch (error) {
      console.error("Failed to get VAPID public key:", error);
      throw new ConvexError({ code: "EXTERNAL_SERVICE_ERROR", message: "Gagal mengaktifkan notifikasi" });
    }
  },
});

type WebSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

function parseSubscription(raw: string): WebSubscription {
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed === "object" && parsed !== null &&
    "endpoint" in parsed && typeof parsed.endpoint === "string" &&
    "keys" in parsed && typeof parsed.keys === "object" && parsed.keys !== null &&
    "p256dh" in parsed.keys && typeof parsed.keys.p256dh === "string" &&
    "auth" in parsed.keys && typeof parsed.keys.auth === "string"
  ) {
    const expirationTime =
      "expirationTime" in parsed && typeof parsed.expirationTime === "number" ? parsed.expirationTime : null;
    return { endpoint: parsed.endpoint, expirationTime, keys: { p256dh: parsed.keys.p256dh, auth: parsed.keys.auth } };
  }
  throw new ConvexError({ code: "BAD_REQUEST", message: "Data langganan notifikasi tidak valid" });
}

export const subscribe = action({
  args: {
    subscription: v.optional(v.string()),
    nativeDevice: v.optional(v.object({ platform: v.literal("ios"), token: v.string() })),
  },
  handler: async (ctx, args): Promise<{ secret: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    const visitorId = identity?.subject ?? crypto.randomUUID();

    let request: SubscribeParams;
    if (args.nativeDevice) {
      // `nativeDevice` is newer than some SDK versions' types, hence the cast
      request = { visitorId, nativeDevice: args.nativeDevice } as unknown as SubscribeParams;
    } else if (args.subscription) {
      const sub = parseSubscription(args.subscription);
      request = {
        visitorId,
        subscription: { endpoint: sub.endpoint, keys: sub.keys, expirationTime: sub.expirationTime },
      };
    } else {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Missing subscription" });
    }
    const { secret } = await hercules.pushNotifications.subscribe(request);
    await ctx.runMutation(internal.pushIdentities.storeIdentity, { secret, visitorId });
    return { secret };
  },
});

export const identify = action({
  args: { secret: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Anda belum masuk" });
    const userId = identity.subject;
    const result = await hercules.pushNotifications.identify({ secret: args.secret, userId });
    if (result.success) {
      await ctx.runMutation(internal.pushIdentities.updateIdentityVisitorId, { secret: args.secret, visitorId: userId });
    }
    return { success: result.success };
  },
});

export const unsubscribe = action({
  args: { secret: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    await hercules.pushNotifications.unsubscribe({ secret: args.secret });
    await ctx.runMutation(internal.pushIdentities.deleteIdentity, { secret: args.secret });
    return { success: true };
  },
});

export const sendNotification = internalAction({
  args: {
    visitorIds: v.array(v.string()),
    title: v.string(),
    body: v.optional(v.string()),
    urgency: v.optional(v.union(v.literal("very-low"), v.literal("low"), v.literal("normal"), v.literal("high"))),
  },
  handler: async (_, args) => {
    // Never broadcast by accident: an empty list means nobody to notify
    if (args.visitorIds.length === 0) return null;
    try {
      await hercules.pushNotifications.send({
        visitorIds: args.visitorIds,
        title: args.title,
        body: args.body,
        urgency: args.urgency ?? "high",
      });
    } catch (error) {
      console.error("Push notification failed:", error);
    }
    return null;
  },
});
