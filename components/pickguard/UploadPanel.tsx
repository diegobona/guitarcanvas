"use client";

import { ImageUp, LoaderCircle, RefreshCw, WandSparkles } from "lucide-react";
import { useRef, useState } from "react";

import {
  removePickguardBackground,
  type BackgroundRemovalProgress,
} from "@/lib/pickguard/backgroundRemoval";
import type { UploadedPhoto } from "@/lib/pickguard/geometry";

type UploadPanelProps = {
  title: string;
  emptyLabel: string;
  replaceLabel: string;
  errorLabel: string;
  photo: UploadedPhoto | null;
  removeBackground?: boolean;
  onPhotoLoaded: (photo: UploadedPhoto) => void;
};

type CutoutState = {
  status: "idle" | "removing" | "done" | "error";
  progress: number;
};

export function UploadPanel({
  title,
  emptyLabel,
  replaceLabel,
  errorLabel,
  photo,
  removeBackground = false,
  onPhotoLoaded,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cutout, setCutout] = useState<CutoutState>({
    status: "idle",
    progress: 0,
  });

  async function handleFile(file: File | undefined) {
    setError(null);
    setCutout({ status: "idle", progress: 0 });

    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError(errorLabel);
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    const dimensions = await readImageDimensions(dataUrl);
    const nextPhoto = {
      dataUrl,
      name: file.name,
      width: dimensions.width,
      height: dimensions.height,
    };

    if (!removeBackground) {
      onPhotoLoaded(nextPhoto);
      return;
    }

    setCutout({ status: "removing", progress: 0 });

    try {
      const cutoutPhoto = await removePickguardBackground({
        file,
        sourcePhoto: nextPhoto,
        onProgress: handleCutoutProgress,
      });
      onPhotoLoaded(cutoutPhoto);
      setCutout({ status: "done", progress: 100 });
    } catch {
      onPhotoLoaded(nextPhoto);
      setCutout({ status: "error", progress: 0 });
      setError("AI cutout failed. The original photo is loaded for now.");
    }
  }

  function handleCutoutProgress(progress: BackgroundRemovalProgress) {
    const percent =
      progress.total > 0
        ? Math.min(99, Math.round((progress.current / progress.total) * 100))
        : 0;
    setCutout({ status: "removing", progress: percent });
  }

  return (
    <section className="panel">
      <h2>{title}</h2>
      <label className="upload-drop">
        {cutout.status === "removing" ? (
          <LoaderCircle aria-hidden className="spin-icon" size={22} />
        ) : removeBackground ? (
          <WandSparkles aria-hidden size={22} />
        ) : (
          <ImageUp aria-hidden size={22} />
        )}
        <span>{photo ? replaceLabel : emptyLabel}</span>
        <input
          ref={inputRef}
          accept="image/jpeg,image/png"
          className="file-input"
          disabled={cutout.status === "removing"}
          type="file"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </label>
      {removeBackground ? (
        <CutoutStatus state={cutout} />
      ) : null}
      {photo ? (
        <p className="file-meta">
          {photo.name} - {photo.width} x {photo.height}px
        </p>
      ) : null}
      {error ? <p className="helper-text">{error}</p> : null}
      {photo ? (
        <button
          className="secondary-button"
          disabled={cutout.status === "removing"}
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <RefreshCw aria-hidden size={17} />
          Re-upload
        </button>
      ) : null}
    </section>
  );
}

function CutoutStatus({ state }: { state: CutoutState }) {
  if (state.status === "idle") {
    return (
      <p className="helper-text">
        Free browser AI removes the background before placing the pickguard.
      </p>
    );
  }

  if (state.status === "removing") {
    return (
      <div className="cutout-progress" aria-live="polite">
        <div className="cutout-progress-bar">
          <span style={{ width: `${state.progress}%` }} />
        </div>
        <p className="helper-text">
          Removing background with local AI... first run can take a minute.
        </p>
      </div>
    );
  }

  if (state.status === "done") {
    return <p className="helper-text">Background removed. Transparent PNG loaded.</p>;
  }

  return null;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this image file."));
    reader.readAsDataURL(file);
  });
}

function readImageDimensions(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Could not decode this image."));
    image.src = src;
  });
}
