/**
 * Panel review BA — muncul di bawah preview dokumen untuk Supervisor ke atas.
 * Hanya tampil jika status BA masih "menunggu".
 */
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { CheckCircle2, XCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

type Props = {
  baId: Id<"beritaAcara">;
  onReviewed: () => void;
};

export default function BeritaAcaraReviewPanel({ baId, onReviewed }: Props) {
  const reviewBA = useMutation(api.insiden.reviewBeritaAcara);
  const [catatan, setCatatan] = useState("");
  const [showCatatan, setShowCatatan] = useState(false);
  const [loading, setLoading] = useState<"disetujui" | "ditolak" | null>(null);

  async function handleReview(status: "disetujui" | "ditolak") {
    if (status === "ditolak" && !catatan.trim()) {
      setShowCatatan(true);
      return;
    }
    setLoading(status);
    try {
      await reviewBA({
        baId,
        status,
        catatanReview: catatan.trim() || undefined,
      });
      toast.success(status === "disetujui" ? "Berita Acara disetujui" : "Berita Acara ditolak");
      onReviewed();
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Gagal memproses review"
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="border-t bg-background p-4 space-y-3 shrink-0">
      <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
        Tindakan Review
      </p>

      {showCatatan && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
            <MessageSquare className="size-3.5" />
            Catatan Penolakan (wajib)
          </div>
          <Textarea
            rows={3}
            className="text-[13px] resize-none"
            placeholder="Tuliskan alasan penolakan..."
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* Catatan opsional untuk persetujuan */}
      {!showCatatan && (
        <Textarea
          rows={2}
          className="text-[13px] resize-none"
          placeholder="Catatan tambahan (opsional)..."
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
        />
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1 h-10 text-[13px] font-semibold bg-green-600 hover:bg-green-700 text-white"
          disabled={!!loading}
          onClick={() => handleReview("disetujui")}
        >
          <CheckCircle2 className="size-4 mr-1.5" />
          {loading === "disetujui" ? "Menyetujui..." : "Setujui"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="flex-1 h-10 text-[13px] font-semibold"
          disabled={!!loading}
          onClick={() => handleReview("ditolak")}
        >
          <XCircle className="size-4 mr-1.5" />
          {loading === "ditolak" ? "Menolak..." : "Tolak"}
        </Button>
      </div>

      {showCatatan && (
        <p className="text-[11px] text-muted-foreground text-center">
          Isi catatan penolakan lalu klik Tolak
        </p>
      )}
    </div>
  );
}
