import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";
import { ROLE_LEVEL } from "@/convex/schema/users";
import type { Role } from "@/convex/schema/users";

export type { Role };

export function useRole() {
  const { user } = useAuth();
  const data = useQuery(api.users.getMyRole, user ? {} : "skip");
  const role: Role | undefined = data?.role as Role | undefined;

  return {
    role,
    userId: data?.userId,
    isLoading: data === undefined,
    isAdmin: role === "admin",
    isFinance: role === "finance",
    isHR: role === "hr",
    isSupervisor: role === "supervisor",
    isDanru: role === "danru",
    isWadanru: role === "wadanru",
    isKoordinator: role === "koordinator",
    isKepalaSekuriti: role === "kepala_sekuriti",
    isManagerOperasional: role === "manager_operasional",
    isAnggota: role === "anggota",
    /** Level numerik (lebih kecil = lebih tinggi) */
    level: role ? ROLE_LEVEL[role] : 99,
    /** Supervisor ke atas (level <= 3) bisa manage ops semua regu */
    canManageOps: role ? ROLE_LEVEL[role] <= 4 : false,
    /** Danru (level 5) hanya regu sendiri */
    isDanruLevel: role === "danru",
    canManagePersonnel:
      role === "admin" ||
      role === "hr" ||
      role === "kepala_sekuriti" ||
      role === "manager_operasional",
    canManageFinance: role === "admin" || role === "finance",
    /** Bisa generate & jadwalkan shift: Super Admin, CSO (kepala_sekuriti), HR, Supervisor */
    canManageSchedule:
      role === "admin" ||
      role === "kepala_sekuriti" ||
      role === "hr" ||
      role === "supervisor",
    isDeviceLocked:
      role === "danru" || role === "wadanru" || role === "anggota",
  };
}
