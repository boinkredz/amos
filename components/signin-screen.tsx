import { motion } from "motion/react";
import { ClipboardCheck, MapPin, ShieldAlert, Users } from "lucide-react";
import Brand from "@/components/brand.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";

const FEATURES = [
{ icon: Users, title: "Personel", desc: "Data petugas, shift, absensi, gaji" },
{ icon: MapPin, title: "Patroli", desc: "Rute, checklist, laporan hasil" },
{ icon: ShieldAlert, title: "Insiden", desc: "Catat kejadian & bukti foto" },
{ icon: ClipboardCheck, title: "Perlengkapan", desc: "Pengecekan kelengkapan kerja" }];


export default function SignInScreen() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-sidebar text-sidebar-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,oklch(0.72_0.16_62/0.18),transparent_55%),radial-gradient(circle_at_85%_90%,oklch(0.55_0.12_252/0.35),transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6">
          
          <Brand subtitleClassName="text-sidebar-foreground/60" />
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight md:text-5xl">
            Kendalikan <span className="text-red-800">seluruh</span> operasional <span className="text-red-800">keamanan</span> dari satu tempat
          </h1>
          <p className="max-w-xl text-balance text-sidebar-foreground/70">
            Personel, jadwal, absensi, penggajian, patroli, dan insiden dalam
            satu sistem terpadu.
          </p>
          <SignInButton
            size="lg"
            signInText="User Login"
            className="hover:bg-accent/90 text-slate-300 bg-red-900" />
          
        </motion.div>

        <div className="md:hidden grid grid-cols-2 gap-2 mb-4">
          {FEATURES.map((f, i) =>
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.08, ease: "easeOut" }}
            className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-4">
            
              <f.icon className="mb-3 size-5 text-red-800" />
              <div className="text-sm font-semibold">{f.title}</div>

            </motion.div>
          )}
        </div>

        <div className="hidden md:flex grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) =>
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.08, ease: "easeOut" }}
            className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-4">
            
              <f.icon className="mb-3 size-5 text-red-800" />
              <div className="text-sm font-semibold">{f.title}</div>
              <div className="text-xs text-sidebar-foreground/60">{f.desc}</div>
            </motion.div>
          )}
        </div>
      </div>
    </div>);

}