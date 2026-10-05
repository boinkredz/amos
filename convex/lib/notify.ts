import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { roleOf } from "./auth";

/** Push visitorId is the identity subject: the part after "|" in tokenIdentifier. */
export function visitorIdOf(user: Doc<"users">): string | null {
  const idx = user.tokenIdentifier.lastIndexOf("|");
  return idx >= 0 ? user.tokenIdentifier.slice(idx + 1) : null;
}

async function userOfOfficer(ctx: MutationCtx, officerId: Id<"officers"> | undefined): Promise<Doc<"users"> | null> {
  if (!officerId) return null;
  const officer = await ctx.db.get(officerId);
  return officer?.userId ? await ctx.db.get(officer.userId) : null;
}

/**
 * Supervisors/Danru who should hear about an officer's attendance:
 * the officer's regu danru (or acting danru), plus supervisor/danru users on duty at the same site that day.
 */
export async function siteLeaderUsers(
  ctx: MutationCtx,
  officer: Doc<"officers">,
  assignment: Doc<"shiftAssignments">,
): Promise<Doc<"users">[]> {
  const leaders = new Map<Id<"users">, Doc<"users">>();
  const add = (u: Doc<"users"> | null) => {
    if (u && u._id !== officer.userId) leaders.set(u._id, u);
  };

  if (officer.reguId) {
    const regu = await ctx.db.get(officer.reguId);
    add(await userOfOfficer(ctx, regu?.actingDanruId ?? regu?.danruId));
  }

  if (assignment.siteId) {
    const sameSite = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_site_date", (q) => q.eq("siteId", assignment.siteId).eq("tanggal", assignment.tanggal))
      .take(200);
    for (const a of sameSite) {
      if (a.officerId === officer._id || a.berhalangan || a.kode === "L") continue;
      const u = await userOfOfficer(ctx, a.officerId);
      if (u && (roleOf(u) === "supervisor" || roleOf(u) === "danru")) add(u);
    }
  }
  return [...leaders.values()];
}

/** Schedule a push to the given users. Silently skips users without a usable identity. */
export async function notifyUsers(
  ctx: MutationCtx,
  users: Array<Doc<"users"> | null>,
  title: string,
  body: string,
): Promise<void> {
  const visitorIds = [...new Set(users.flatMap((u) => (u ? [visitorIdOf(u)] : [])).filter((v): v is string => !!v))];
  if (visitorIds.length === 0) return;
  await ctx.scheduler.runAfter(0, internal.pushNotifications.sendNotification, { visitorIds, title, body });
}

export async function notifyOfficer(
  ctx: MutationCtx,
  officerId: Id<"officers">,
  title: string,
  body: string,
): Promise<void> {
  await notifyUsers(ctx, [await userOfOfficer(ctx, officerId)], title, body);
}

/** "HH:mm" in WIB for notification text. */
export function jamWib(ms: number): string {
  const d = new Date(ms + 7 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
