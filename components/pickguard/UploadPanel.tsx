"use client";

import {
  Check,
  ImageUp,
  LoaderCircle,
  RefreshCw,
  Scissors,
  Trash2,
  Undo2,
  WandSparkles,
} from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";

import {
  removePickguardBackground,
  type BackgroundRemovalProgress,
} from "@/lib/pickguard/backgroundRemoval";
import type { Point, UploadedPhoto } from "@/lib/pickguard/geometry";
import { createManualCutout } from "@/lib/pickguard/manualCutout";

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
  status: "idle" | "removing" | "done" | "manualDone" | "error";
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
  const [sourcePhoto, setSourcePhoto] = useState<UploadedPhoto | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPoints, setManualPoints] = useState<Point[]>([]);
  const [manualInset, setManualInset] = useState(4);
  const [manualApplying, setManualApplying] = useState(false);

  async function handleFile(file: File | undefined) {
    setError(null);
    setCutout({ status: "idle", progress: 0 });
    setManualOpen(false);
    setManualPoints([]);
    setSourcePhoto(null);

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
    setSourcePhoto(nextPhoto);

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

  async function handleApplyManualCutout() {
    if (!sourcePhoto || manualPoints.length < 3) return;

    setError(null);
    setManualApplying(true);
    try {
      const manualPhoto = await createManualCutout(sourcePhoto, manualPoints, {
        insetPx: manualInset,
      });
      onPhotoLoaded(manualPhoto);
      setCutout({ status: "manualDone", progress: 100 });
      setManualOpen(false);
    } catch {
      setCutout({ status: "error", progress: 0 });
      setError("Clean outline failed. Please redraw the pickguard outline.");
    } finally {
      setManualApplying(false);
    }
  }

  async function handleApplyColorManualCutout() {
    if (!sourcePhoto || manualPoints.length < 3) return;

    setError(null);
    setManualApplying(true);
    setCutout({ status: "removing", progress: 0 });
    try {
      const { createColorRefinedManualCutout } = await import(
        "@/lib/pickguard/manualCutout"
      );
      const manualPhoto = await createColorRefinedManualCutout(
        sourcePhoto,
        manualPoints,
        {
          insetPx: manualInset,
          onProgress: handleCutoutProgress,
        },
      );
      onPhotoLoaded(manualPhoto);
      setCutout({ status: "manualDone", progress: 100 });
      setManualOpen(false);
    } catch {
      setCutout({ status: "error", progress: 0 });
      setError("Color cleanup failed. Try clean outline with edge trim.");
    } finally {
      setManualApplying(false);
    }
  }

  return (
    <section className="panel">
      <h2>{title}</h2>
      <label className="upload-drop" suppressHydrationWarning>
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
      {removeBackground && sourcePhoto ? (
        <div className="manual-cutout-actions">
          <button
            className="secondary-button"
            disabled={cutout.status === "removing"}
            type="button"
            onClick={() => setManualOpen((isOpen) => !isOpen)}
          >
            <Scissors aria-hidden size={17} />
            Manual outline
          </button>
        </div>
      ) : null}
      {manualOpen && sourcePhoto ? (
        <ManualCutoutEditor
          applying={manualApplying}
          insetPx={manualInset}
          photo={sourcePhoto}
          points={manualPoints}
          onApply={handleApplyManualCutout}
          onApplyColor={handleApplyColorManualCutout}
          onClear={() => setManualPoints([])}
          onInsetChange={setManualInset}
          onPointAdd={(point) =>
            setManualPoints((currentPoints) => [...currentPoints, point])
          }
          onUndo={() =>
            setManualPoints((currentPoints) => currentPoints.slice(0, -1))
          }
        />
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
        Free browser AI removes backgrounds. Use manual outline when the source
        includes the whole guitar.
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
          Processing cutout... first AI run can take a minute.
        </p>
      </div>
    );
  }

  if (state.status === "done") {
    return <p className="helper-text">Background removed. Transparent PNG loaded.</p>;
  }

  if (state.status === "manualDone") {
    return <p className="helper-text">Clean outline applied. Transparent PNG loaded.</p>;
  }

  return null;
}

type ManualCutoutEditorProps = {
  applying: boolean;
  insetPx: number;
  photo: UploadedPhoto;
  points: Point[];
  onApply: () => void;
  onApplyColor: () => void;
  onClear: () => void;
  onInsetChange: (insetPx: number) => void;
  onPointAdd: (point: Point) => void;
  onUndo: () => void;
};

function ManualCutoutEditor({
  applying,
  insetPx,
  photo,
  points,
  onApply,
  onApplyColor,
  onClear,
  onInsetChange,
  onPointAdd,
  onUndo,
}: ManualCutoutEditorProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const frame = frameRef.current;
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    onPointAdd({
      x: clamp(((event.clientX - rect.left) / rect.width) * photo.width, 0, photo.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * photo.height, 0, photo.height),
    });
  }

  const svgPoints = points
    .map((point) => `${(point.x / photo.width) * 100},${(point.y / photo.height) * 100}`)
    .join(" ");

  return (
    <div className="manual-cutout-editor">
      <div
        aria-label="Pickguard manual outline editor"
        className="manual-cutout-frame"
        ref={frameRef}
        role="button"
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        tabIndex={0}
        onPointerDown={handlePointerDown}
      >
        <img alt="Original pickguard source" draggable={false} src={photo.dataUrl} />
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none">
          {points.length > 1 ? (
            <polyline className="manual-cutout-line" points={svgPoints} />
          ) : null}
          {points.length > 2 ? (
            <polygon className="manual-cutout-fill" points={svgPoints} />
          ) : null}
          {points.map((point, index) => (
            <circle
              className="manual-cutout-point"
              cx={(point.x / photo.width) * 100}
              cy={(point.y / photo.height) * 100}
              key={`${point.x}-${point.y}-${index}`}
              r="1.35"
            />
          ))}
        </svg>
      </div>
      <p className="helper-text">
        Click around the pickguard, then trim the edge inward to remove extra
        guitar body or background.
      </p>
      <label className="field manual-cutout-trim">
        <span>Edge trim</span>
        <input
          max="18"
          min="0"
          step="1"
          type="range"
          value={insetPx}
          onChange={(event) => onInsetChange(Number(event.target.value))}
        />
      </label>
      <div className="manual-cutout-toolbar">
        <button
          className="icon-button"
          disabled={points.length === 0 || applying}
          title="Undo point"
          type="button"
          onClick={onUndo}
        >
          <Undo2 aria-hidden size={17} />
        </button>
        <button
          className="icon-button"
          disabled={points.length === 0 || applying}
          title="Clear outline"
          type="button"
          onClick={onClear}
        >
          <Trash2 aria-hidden size={17} />
        </button>
        <button
          className="primary-button"
          disabled={points.length < 3 || applying}
          type="button"
          onClick={onApply}
        >
          {applying ? (
            <LoaderCircle aria-hidden className="spin-icon" size={17} />
          ) : (
            <Check aria-hidden size={17} />
          )}
          Apply clean outline
        </button>
        <button
          className="secondary-button manual-color-button"
          disabled={points.length < 3 || applying}
          type="button"
          onClick={onApplyColor}
        >
          <WandSparkles aria-hidden size={17} />
          Clean body color
        </button>
      </div>
    </div>
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
