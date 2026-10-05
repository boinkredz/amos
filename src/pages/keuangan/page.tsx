import { useState } from "react";
import { Authenticated } from "convex/react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight, BookOpen, CreditCard, Settings, FileText } from "lucide-react";
import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { cn } from "@/lib/utils.ts";
import BukuBesarTab from "./_components/buku-besar-tab.tsx";
import KasbonTab from "./_components/kasbon-tab.tsx";
import RekapGajiTab from "./_components/rekap-gaji-tab.tsx";
import PengaturanGajiTab from "./_components/pengaturan-gaji-tab.tsx";
import { useRole } from "@/hooks/use-role.ts";

function periodeLabel(periode: string): string {
  const [year, month] = periode.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return format(d, "MMMM yyyy", { locale: idLocale });
}

function shiftPeriode(periode: string, delta: number): string {
  const [year, month] = periode.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function KeuanganPage() {
  const { canManageOps } = useRole();
  const [tab, setTab] = useState("rekap");
  const todayPeriode = format(new Date(), "yyyy-MM");
  const [periode, setPeriode] = useState(todayPeriode);

  const TAB_ITEMS = [
    { value: "rekap", label: "Slip Gaji", icon: <FileText className="size-5" /> },
    ...(canManageOps ? [{ value: "buku", label: "Buku Besar", icon: <BookOpen className="size-5" /> }] : []),
    { value: "kasbon", label: "Kasbon", icon: <CreditCard className="size-5" /> },
    ...(canManageOps ? [{ value: "pengaturan", label: "Pengaturan", icon: <Settings className="size-5" /> }] : []),
  ];

  return (
    <Authenticated>
      <div>
        <PageHeader
          title="Arus Kas"
          description="Kelola komponen gaji, kasbon, buku besar, dan rekap penggajian petugas."
        />

        {/* Period navigator */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            onClick={() => setPeriode(shiftPeriode(periode, -1))}
            className="size-9 flex items-center justify-center rounded-lg border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex-1 text-center text-sm font-semibold text-foreground border rounded-lg bg-card py-2 px-3">
            {periodeLabel(periode)}
          </div>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            onClick={() => setPeriode(shiftPeriode(periode, 1))}
            disabled={periode >= todayPeriode}
            className="size-9 flex items-center justify-center rounded-lg border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          {/* Mobile: grid icon menu */}
          <div className={cn(
            "md:hidden grid gap-2 mb-4",
            TAB_ITEMS.length <= 2 ? "grid-cols-2" : TAB_ITEMS.length === 3 ? "grid-cols-3" : "grid-cols-4"
          )}>
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
            <TabsTrigger value="rekap" className="shrink-0">Slip Gaji</TabsTrigger>
            {canManageOps && <TabsTrigger value="buku" className="shrink-0">Buku Besar</TabsTrigger>}
            <TabsTrigger value="kasbon" className="shrink-0">Kasbon</TabsTrigger>
            {canManageOps && <TabsTrigger value="pengaturan" className="shrink-0">Pengaturan Gaji</TabsTrigger>}
          </TabsList>

          <TabsContent value="rekap">
            <RekapGajiTab periode={periode} />
          </TabsContent>
          <TabsContent value="buku">
            <BukuBesarTab periode={periode} />
          </TabsContent>
          <TabsContent value="kasbon">
            <KasbonTab />
          </TabsContent>
          <TabsContent value="pengaturan">
            <PengaturanGajiTab />
          </TabsContent>
        </Tabs>
      </div>
    </Authenticated>
  );
}
