import { useState } from "react";
import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { cn } from "@/lib/utils.ts";
import { ClipboardCheck, ArrowLeftRight, AlertTriangle, Wrench } from "lucide-react";
import MasterPerlengkapan from "./_components/master-perlengkapan.tsx";
import ChecklistShift from "./_components/checklist-shift.tsx";
import RiwayatTracking from "./_components/riwayat-tracking.tsx";
import SerahTerima from "./_components/serah-terima.tsx";

const TAB_ITEMS = [
  { value: "checklist", label: "Checklist Shift", icon: <ClipboardCheck className="size-5" /> },
  { value: "serah-terima", label: "Serah Terima", icon: <ArrowLeftRight className="size-5" /> },
  { value: "riwayat", label: "Tindak Lanjut", icon: <AlertTriangle className="size-5" /> },
  { value: "master", label: "Master Alat", icon: <Wrench className="size-5" /> },
];

export default function PerlengkapanPage() {
  const [tab, setTab] = useState("checklist");

  return (
    <div>
      <PageHeader
        title="Perlengkapan Kerja"
        description="Pengecekan kelengkapan peralatan petugas per shift dan serah terima."
      />
      <Unauthenticated>
        <div className="flex items-center justify-center py-12">
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          {/* Mobile: grid icon menu */}
          <div className="md:hidden grid grid-cols-4 gap-2">
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
          <TabsList className="hidden md:flex w-full overflow-x-auto flex-nowrap h-auto">
            <TabsTrigger value="checklist" className="shrink-0">Checklist Shift</TabsTrigger>
            <TabsTrigger value="serah-terima" className="shrink-0">Serah Terima</TabsTrigger>
            <TabsTrigger value="riwayat" className="shrink-0">Riwayat & Tindak Lanjut</TabsTrigger>
            <TabsTrigger value="master" className="shrink-0">Master Alat</TabsTrigger>
          </TabsList>

          <TabsContent value="checklist">
            <ChecklistShift />
          </TabsContent>
          <TabsContent value="serah-terima">
            <SerahTerima />
          </TabsContent>
          <TabsContent value="riwayat">
            <RiwayatTracking siteId={null} />
          </TabsContent>
          <TabsContent value="master">
            <MasterPerlengkapan />
          </TabsContent>
        </Tabs>
      </Authenticated>
    </div>
  );
}
