import { useRef, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button.tsx";
import { Eraser } from "lucide-react";

type Props = {
  onEnd: (dataUrl: string) => void;
  width?: number;
  height?: number;
};

export default function SignaturePad({ onEnd, width = 300, height = 150 }: Props) {
  const sigRef = useRef<SignatureCanvas>(null);

  const handleEnd = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      const dataUrl = sigRef.current.toDataURL("image/png");
      onEnd(dataUrl);
    }
  }, [onEnd]);

  const handleClear = () => {
    sigRef.current?.clear();
  };

  return (
    <div className="space-y-1">
      <div className="rounded border border-dashed border-muted-foreground/40 bg-white">
        <SignatureCanvas
          ref={sigRef}
          penColor="black"
          canvasProps={{
            width,
            height,
            className: "rounded cursor-crosshair",
          }}
          onEnd={handleEnd}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="cursor-pointer text-xs"
        onClick={handleClear}
      >
        <Eraser className="mr-1 h-3 w-3" /> Hapus
      </Button>
    </div>
  );
}
