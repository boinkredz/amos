import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Authenticated } from "convex/react";
import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import JadwalHarianTab from "./_components/jadwal-harian-tab.tsx";
import JadwalKalenderTab from "./_components/jadwal-kalender-tab.tsx";
import RekapAbsensiTab from "./_components/rekap-absensi-tab.tsx";
import ShiftTemplatesTab from "./_components/shift-templates-tab.tsx";
import TukarShiftTab from "./_components/tukar-shift-tab.tsx";
import CutiIzinTab from "./_components/cuti-izin-tab.tsx";
import GenerateJadwalTab from "./_components/generate-jadwal-tab.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { cn } from "@/lib/utils.ts";
import {
  CalendarDays, Wand2, CalendarRange, UmbrellaOff, ArrowLeftRight, BarChart2, LayoutTemplate, Activity, Gauge,
} from "lucide-react";
import MonitoringTab from "./_components/monitoring-tab.tsx";
import RekapKpiTab from "./_components/rekap-kpi-tab.tsx";

type TabItem = { value: string; label: string; icon: React.ReactNode; adminOnly?: boolean; monitorOnly?: boolean; kpiOnly?: boolean };

const TAB_ITEMS: TabItem[] = [
  { value: "harian", label: "Jadwal Harian", icon: <CalendarDays className="size-5" /> },
  { value: "monitoring", label: "Monitoring", icon: <Activity className="size-5" />, monitorOnly: true },
  { value: "generate", label: "Generate", icon: <Wand2 className="size-5" />, adminOnly: true },
  { value: "kalender", label: "Kalender", icon: <CalendarRange className="size-5" /> },
  { value: "cuti", label: "Cuti & Sakit", icon: <UmbrellaOff className="size-5" /> },
  { value: "tukar", label: "Tukar Shift", icon: <ArrowLeftRight className="size-5" /> },
  { value: "rekap", label: "Rekap Absensi", icon: <BarChart2 className="size-5" /> },
  { value: "kpi", label: "Rekap KPI", icon: <Gauge className="size-5" />, kpiOnly: true },
  { value: "shift", label: "Template", icon: <LayoutTemplate className="size-5" /> },
];

export default function AbsensiPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "harian");
  const { canManageSchedule, canManageOps, isDanru, isHR, isLoading, isFinance } = useRole();
  const canMonitor = !isLoading && (canManageOps || isDanru);
  const canKpi = !isLoading && (canManageOps || isDanru || isHR);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setTab(t);
  }, [searchParams]);

  return (
    <Authenticated>
      <div>
        <PageHeader
          title="Jadwal Shift"
          description="Kelola jadwal shift, kalender penugasan, tukar shift, cuti & absensi."
        />
        {isFinance ? (
          <div className="rounded-xl border bg-card p-8 text-center space-y-2">
            <p className="font-medium">Akses Ditolak</p>
            <p className="text-sm text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</p>
          </div>
        ) : (
        <Tabs value={tab} onValueChange={setTab}>
          {/* Mobile: grid icon menu */}
          <div className="md:hidden grid grid-cols-4 gap-2 mb-4">
            {TAB_ITEMS.filter(t => (!t.adminOnly || (!isLoading && canManageSchedule)) && (!t.monitorOnly || canMonitor) && (!t.kpiOnly || canKpi)).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl p-2.5 cursor-pointer transition-colors",
                  tab === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t.icon}
                <span className="text-[10px] font-semibold leading-tight text-center">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Desktop: scrollable tab bar */}
          <TabsList className="hidden md:flex mb-4 w-full overflow-x-auto flex-nowrap h-auto">
            <TabsTrigger value="harian" className="shrink-0">Jadwal Harian</TabsTrigger>
            {canMonitor && (
              <TabsTrigger value="monitoring" className="shrink-0">Monitoring</TabsTrigger>
            )}
            {!isLoading && canManageSchedule && (
              <TabsTrigger value="generate" className="shrink-0">Generate Jadwal</TabsTrigger>
            )}
            <TabsTrigger value="kalender" className="shrink-0">Kalender</TabsTrigger>
            <TabsTrigger value="cuti" className="shrink-0">Cuti & Sakit</TabsTrigger>
            <TabsTrigger value="tukar" className="shrink-0">Tukar Shift</TabsTrigger>
            <TabsTrigger value="rekap" className="shrink-0">Rekap Absensi</TabsTrigger>
            {canKpi && <TabsTrigger value="kpi" className="shrink-0">Rekap KPI</TabsTrigger>}
            <TabsTrigger value="shift" className="shrink-0">Template Shift</TabsTrigger>
          </TabsList>
          <TabsContent value="harian">
            <JadwalHarianTab />
          </TabsContent>
          {canMonitor && (
            <TabsContent value="monitoring">
              <MonitoringTab />
            </TabsContent>
          )}
          {canManageSchedule && (
            <TabsContent value="generate">
              <GenerateJadwalTab />
            </TabsContent>
          )}
          <TabsContent value="kalender">
            <JadwalKalenderTab />
          </TabsContent>
          <TabsContent value="cuti">
            <CutiIzinTab />
          </TabsContent>
          <TabsContent value="tukar">
            <TukarShiftTab />
          </TabsContent>
          <TabsContent value="rekap">
            <RekapAbsensiTab />
          </TabsContent>
          {canKpi && (
            <TabsContent value="kpi">
              <RekapKpiTab />
            </TabsContent>
          )}
          <TabsContent value="shift">
            <ShiftTemplatesTab />
          </TabsContent>
        </Tabs>
        )}
      </div>
    </Authenticated>
  );
}
