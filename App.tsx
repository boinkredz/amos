import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import AppLayout from "./components/app-layout.tsx";
import ComingSoon from "./components/coming-soon.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import PetugasPage from "./pages/petugas/page.tsx";
import PeranPage from "./pages/pengaturan/peran/page.tsx";
import AbsensiPage from "./pages/absensi/page.tsx";
import PatroliPage from "./pages/patroli/page.tsx";
import TugasDetailPage from "./pages/patroli/tugas/page.tsx";
import LaporanPage from "./pages/patroli/laporan/page.tsx";
import SitePage from "./pages/master/site/page.tsx";

import GeoFencePage from "./pages/master/geofence/page.tsx";
import MasterJabatanPage from "./pages/master/jabatan/page.tsx";
import ReguPage from "./pages/master/regu/page.tsx";
import InsidenPage from "./pages/insiden/page.tsx";
import PerlengkapanPage from "./pages/perlengkapan/page.tsx";
import KeuanganPage from "./pages/keuangan/page.tsx";
import AbsenMandiriPage from "./pages/absen-mandiri/page.tsx";

export default function App() {
  useServiceWorker();
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/petugas" element={<PetugasPage />} />
            <Route path="/pengaturan/peran" element={<PeranPage />} />
            <Route path="/absensi" element={<AbsensiPage />} />
            <Route path="/keuangan" element={<KeuanganPage />} />
            <Route path="/absen-mandiri" element={<AbsenMandiriPage />} />
            <Route path="/patroli" element={<PatroliPage />} />
            <Route path="/patroli/tugas/:tugasId" element={<TugasDetailPage />} />
            <Route path="/patroli/laporan/:tugasId" element={<LaporanPage />} />
            <Route path="/master/site" element={<SitePage />} />
            <Route path="/master/geofence" element={<GeoFencePage />} />
            <Route path="/master/jabatan" element={<MasterJabatanPage />} />
            <Route path="/master/regu" element={<ReguPage />} />
            <Route path="/insiden" element={<InsidenPage />} />
            <Route path="/perlengkapan" element={<PerlengkapanPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
