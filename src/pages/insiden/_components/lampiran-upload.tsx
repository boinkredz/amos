import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type LampiranItem = {
  storageId: Id<"_storage">;
  keterangan: string;
  previewUrl?: string;
};

type Props = {
  value: LampiranItem[];
  onChange: (items: LampiranItem[]) => void;
};

export default function LampiranUpload({ value, onChange }: Props) {
  const generateUploadUrl = useMutation(api.insiden.generateUploadUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newItems: LampiranItem[] = [];
      for (const file of Array.from(files)) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
        newItems.push({
          storageId,
          keterangan: "",
          previewUrl: URL.createObjectURL(file),
        });
      }
      onChange([...value, ...newItems]);
    } catch {
      toast.error("Gagal mengunggah foto");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateKeterangan = (index: number, keterangan: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], keterangan };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="cursor-pointer"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}
          {uploading ? "Mengunggah..." : "Tambah Foto"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        {value.length > 0 && (
          <span className="text-xs text-muted-foreground">{value.length} foto</span>
        )}
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((item, i) => (
            <div key={item.storageId} className="relative rounded-lg border p-2 space-y-2">
              {item.previewUrl && (
                <img
                  src={item.previewUrl}
                  alt={`Lampiran ${i + 1}`}
                  className="h-24 w-full rounded object-cover"
                />
              )}
              <Input
                placeholder="Keterangan foto..."
                value={item.keterangan}
                onChange={(e) => updateKeterangan(i, e.target.value)}
                className="text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6 cursor-pointer bg-background/80"
                onClick={() => removeItem(i)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
