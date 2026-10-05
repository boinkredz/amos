import {
  BarChart3,
  Briefcase,
  Building2,
  ClipboardCheck,
  Fingerprint,
  MapPin,
  Settings,
  ShieldAlert,
  Users,
  UsersRound,
  Wallet,
  CalendarClock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/convex/schema/users";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  group?: string;
  showInBottomNav?: boolean;
  /** Roles allowed to see this item. Undefined = all roles. */
  roles?: ReadonlyArray<Role>;
};

const OPS_ROLES: ReadonlyArray<Role> = [
  "admin",
  "manager_operasional",
  "kepala_sekuriti",
  "supervisor",
  "koordinator",
];

const FIELD_ROLES: ReadonlyArray<Role> = [...OPS_ROLES, "danru", "wadanru", "anggota"];

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: "Dashboard", to: "/", icon: BarChart3, showInBottomNav: true },
  {
    label: "Petugas", to: "/petugas", icon: Users, showInBottomNav: true,
    roles: ["admin", "hr", "supervisor", "kepala_sekuriti", "manager_operasional"],
  },
  { label: "Absen Mandiri", to: "/absen-mandiri", icon: Fingerprint, showInBottomNav: true },
  {
    label: "Jadwal Shift", to: "/absensi", icon: CalendarClock,
    roles: [...FIELD_ROLES, "hr"],
  },
  {
    label: "Arus Kas", to: "/keuangan", icon: Wallet,
    // semua role bisa akses, tapi data difilter di halaman
  },
  {
    label: "Patroli", to: "/patroli", icon: MapPin, showInBottomNav: true,
    roles: FIELD_ROLES,
  },
  {
    label: "Insiden & B.A", to: "/insiden", icon: ShieldAlert, showInBottomNav: true,
    roles: FIELD_ROLES,
  },
  {
    label: "Perlengkapan", to: "/perlengkapan", icon: ClipboardCheck,
    roles: FIELD_ROLES,
  },
  {
    label: "Operasional", to: "/master/site", icon: Building2, group: "Master Data",
    roles: ["admin"],
  },
  {
    label: "Geo Fence", to: "/master/geofence", icon: MapPin, group: "Master Data",
    roles: ["admin"],
  },
  {
    label: "Regu", to: "/master/regu", icon: UsersRound, group: "Master Data",
    roles: ["admin", "supervisor", "kepala_sekuriti", "manager_operasional"],
  },
  {
    label: "Divisi", to: "/master/jabatan", icon: Briefcase, group: "Master Data",
    roles: ["admin", "hr", "kepala_sekuriti", "manager_operasional"],
  },
  {
    label: "Users Roles", to: "/pengaturan/peran", icon: Settings, group: "Pengaturan",
    roles: ["admin"],
  },
];
