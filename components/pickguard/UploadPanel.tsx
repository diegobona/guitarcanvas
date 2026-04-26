"use client";

import { ImageUp, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";

import type { UploadedPhoto } from "@/lib/pickguard/geometry";

type UploadPanelProps = {
  photo: UploadedPhoto | null;
  onPhotoLoaded: (photo: UploadedPhoto) => void;
};

export function UploadPanel({ photo, onPhotoLoaded }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    setError(null);

    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Please upload a JPG or PNG guitar photo.");
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    const dimensions = await readImageDimensions(dataUrl);
    onPhotoLoaded({
      dataUrl,
      name: file.name,
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  return (
    <section className="panel">
      <h2>1. Guitar photo</h2>
      <label className="upload-drop">
        <ImageUp aria-hidden size={22} />
        <span>{photo ? "Replace guitar photo" : "Upload JPG or PNG"}</span>
        <input
          ref={inputRef}
          accept="image/jpeg,image/png"
          className="file-input"
          type="file"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </label>
      {photo ? (
        <p className="file-meta">
          {photo.name} · {photo.width} × {photo.height}px
        </p>
      ) : (
        <p className="helper-text">
          Use a straight-on photo when possible. The editor is for visual
          mockups, so manual alignment is expected.
        </p>
      )}
      {error ? <p className="helper-text">{error}</p> : null}
      {photo ? (
        <button
          className="secondary-button"
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
