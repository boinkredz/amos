import { useState } from "react";
import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { cn } from "@/lib/utils.ts";
import { FileText, ClipboardList } from "lucide-react";
import BeritaAcaraList from "./_components/berita-acara-list.tsx";
import LaporanHarianList from "./_components/laporan-harian-list.tsx";

const TAB_ITEMS = [
  { value: "berita-acara", label: "Berita Acara", icon: <FileText className="size-5" /> },
  { value: "laporan-harian", label: "Laporan Harian", icon: <ClipboardList className="size-5" /> },
];

export default function InsidenPage() {
  const [tab, setTab] = useState("berita-acara");

  return (
    <div>
      <PageHeader
        title="Insiden & Laporan"
        description="Pencatatan kejadian insiden dan laporan harian pengamanan."
      />
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        {/* Mobile: grid icon menu */}
        <div className="md:hidden grid grid-cols-2 gap-2">
          {TAB_ITEMS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl p-3 cursor-pointer transition-colors",
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
          <TabsTrigger value="berita-acara" className="shrink-0">Berita Acara</TabsTrigger>
          <TabsTrigger value="laporan-harian" className="shrink-0">Laporan Harian</TabsTrigger>
        </TabsList>

        <TabsContent value="berita-acara">
          <BeritaAcaraList />
        </TabsContent>
        <TabsContent value="laporan-harian">
          <LaporanHarianList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
