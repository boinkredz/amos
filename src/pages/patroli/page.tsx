import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Authenticated } from "convex/react";
import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import PenugasanTab from "./_components/penugasan-tab.tsx";
import RuteTab from "./_components/rute-tab.tsx";
import CheckpointTab from "./_components/checkpoint-tab.tsx";
import MonitoringTab from "./_components/monitoring-tab.tsx";
import { cn } from "@/lib/utils.ts";
import { ClipboardList, Map, CheckSquare, Activity } from "lucide-react";

const TAB_ITEMS = [
  { value: "penugasan", label: "Penugasan", icon: <ClipboardList className="size-5" /> },
  { value: "rute", label: "Rute Patroli", icon: <Map className="size-5" /> },
  { value: "checkpoint", label: "Checkpoint", icon: <CheckSquare className="size-5" /> },
  { value: "monitoring", label: "Monitoring", icon: <Activity className="size-5" /> },
];

export default function PatroliPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "penugasan");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setTab(t);
  }, [searchParams]);

  return (
    <Authenticated>
      <div>
        <PageHeader title="Patroli & Tugas" description="Rute patroli, penugasan, dan laporan hasil patroli petugas keamanan." />
        <Tabs value={tab} onValueChange={setTab}>
          {/* Mobile: grid icon menu */}
          <div className="md:hidden grid grid-cols-4 gap-2 mb-4">
            {TAB_ITEMS.map((t) => (
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
            <TabsTrigger value="penugasan" className="shrink-0">Penugasan</TabsTrigger>
            <TabsTrigger value="rute" className="shrink-0">Rute Patroli</TabsTrigger>
            <TabsTrigger value="checkpoint" className="shrink-0">Checkpoint</TabsTrigger>
            <TabsTrigger value="monitoring" className="shrink-0">Monitoring</TabsTrigger>
          </TabsList>

          <TabsContent value="penugasan"><PenugasanTab /></TabsContent>
          <TabsContent value="rute"><RuteTab onLihatCheckpoint={() => setTab("checkpoint")} /></TabsContent>
          <TabsContent value="checkpoint"><CheckpointTab /></TabsContent>
          <TabsContent value="monitoring"><MonitoringTab /></TabsContent>
        </Tabs>
      </div>
    </Authenticated>
  );
}
