"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { UploadedFile } from "./file-upload";

/**
 * Browser voice recorder. Records with MediaRecorder and uploads the result
 * through the same authenticated upload route as any other file.
 */
export function Recorder({ assignmentPublicId, onUploaded }: { assignmentPublicId?: string | null; onUploaded: (file: UploadedFile) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "uploading" | "unsupported">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (!navigator.mediaDevices || typeof MediaRecorder === "undefined")) setState("unsupported");
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType.split(";")[0] || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        setState("uploading");
        const fd = new FormData();
        fd.append("file", new File([blob], `recording-${Date.now()}.${type.includes("mp4") ? "m4a" : "webm"}`, { type }));
        fd.append("purpose", "AUDIO_RECORDING");
        if (assignmentPublicId) fd.append("assignment", assignmentPublicId);
        try {
          const res = await fetch("/api/uploads", { method: "POST", body: fd });
          const json = (await res.json()) as UploadedFile & { error?: string };
          if (!res.ok) throw new Error(json.error ?? "Upload failed");
          onUploaded(json);
        } catch (err) {
          setError((err as Error).message);
        }
        setState("idle");
        setSeconds(0);
      };
      rec.start(1000);
      recorder.current = rec;
      setState("recording");
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError((err as Error).message || "Microphone access was denied");
    }
  }

  function stop() {
    if (timer.current) window.clearInterval(timer.current);
    recorder.current?.stop();
  }

  if (state === "unsupported") return <p className="text-xs text-ink-3">Recording is not supported in this browser. Upload an audio file instead.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === "recording" ? (
        <Button type="button" variant="danger" size="sm" onClick={stop}>
          ■ Stop ({Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")})
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={start} disabled={state === "uploading"}>
          {state === "uploading" ? "Uploading…" : "● Record"}
        </Button>
      )}
      {state === "recording" ? <span className="text-xs text-danger">Recording… speak naturally, you can ramble.</span> : null}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
