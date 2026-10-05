import type { JenisInsiden } from "@/convex/schema/insiden";

export const JENIS_INSIDEN_LABELS: Record<JenisInsiden, string> = {
  kehilangan: "Kehilangan",
  maintenance: "Maintenance",
  kerusakan_pengunjung: "Kerusakan oleh Pengunjung",
  pelanggaran_peraturan: "Pelanggaran Peraturan",
  pelanggaran_anggota: "Pelanggaran Anggota",
  pencurian: "Pencurian",
  kebakaran: "Kebakaran",
  kerusakan_fasilitas: "Kerusakan Fasilitas",
  gangguan_ketertiban: "Gangguan Ketertiban",
  kecelakaan: "Kecelakaan",
  akses_tidak_sah: "Akses Tidak Sah",
  gangguan_teknis: "Gangguan Teknis",
  lainnya: "Lainnya",
};
