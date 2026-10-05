import { useCallback, useEffect, useRef, useState } from "react";

export type FacingMode = "user" | "environment";

export function useCamera(
  options: { facingMode?: FacingMode; width?: number; height?: number } = {},
) {
  const { facingMode = "user", width = 640, height = 480 } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDenied, setIsDenied] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState<FacingMode>(facingMode);

  const isSupported =
    typeof navigator !== "undefined" &&
    "mediaDevices" in navigator &&
    "getUserMedia" in navigator.mediaDevices;

  const stop = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stream]);

  const start = useCallback(async () => {
    if (!isSupported) return setError("Kamera tidak didukung pada perangkat ini");
    setIsLoading(true);
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode, width: { ideal: width }, height: { ideal: height } },
        audio: false,
      });
      setStream(mediaStream);
      setIsDenied(false);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (err) {
      const name = (err as Error).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setIsDenied(true);
        setError("Izin kamera ditolak. Aktifkan kamera di pengaturan browser.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("Tidak ada kamera pada perangkat ini");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setError("Kamera sedang digunakan aplikasi lain");
      } else {
        setError("Gagal mengakses kamera");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, currentFacingMode, width, height]);

  const switchCamera = useCallback(() => {
    stop();
    setCurrentFacingMode((m) => (m === "user" ? "environment" : "user"));
  }, [stop]);

  useEffect(() => {
    if (stream) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFacingMode]);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !stream) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  return { videoRef, stream, isLoading, error, isSupported, isDenied, start, stop, switchCamera, capturePhoto };
}
