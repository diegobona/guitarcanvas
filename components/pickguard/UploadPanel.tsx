"use client";

import {
  Eraser,
  ImageUp,
  LoaderCircle,
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
import type { EraseStroke } from "@/lib/pickguard/manualCutout";

type UploadPanelProps = {
  title: string;
  emptyLabel: string;
  replaceLabel: string;
  errorLabel: string;
  photo: UploadedPhoto | null;
  allowPickguardSourceMode?: boolean;
  removeBackground?: boolean;
  onPhotoLoaded: (photo: UploadedPhoto) => void;
};

type CutoutState = {
  status: "idle" | "removing" | "done" | "manualDone" | "error";
  progress: number;
};

type ManualMode = "outline" | "target";
type PickguardSourceMode = "single" | "guitar";

export function UploadPanel({
  title,
  emptyLabel,
  replaceLabel,
  errorLabel,
  photo,
  allowPickguardSourceMode = false,
  removeBackground = false,
  onPhotoLoaded,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewRequestRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [cutout, setCutout] = useState<CutoutState>({
    status: "idle",
    progress: 0,
  });
  const [sourcePhoto, setSourcePhoto] = useState<UploadedPhoto | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPoints, setManualPoints] = useState<Point[]>([]);
  const [manualMode, setManualMode] = useState<ManualMode>("outline");
  const [manualTargetPoint, setManualTargetPoint] = useState<Point | null>(null);
  const [manualSegmentPreview, setManualSegmentPreview] =
    useState<UploadedPhoto | null>(null);
  const [manualPreviewLoading, setManualPreviewLoading] = useState(false);
  const [manualApplying, setManualApplying] = useState(false);
  const [manualResultPhoto, setManualResultPhoto] = useState<UploadedPhoto | null>(
    null,
  );
  const [manualResultHistory, setManualResultHistory] = useState<UploadedPhoto[]>(
    [],
  );
  const [resultEraseRadius, setResultEraseRadius] = useState(24);
  const [resultEraseApplying, setResultEraseApplying] = useState(false);
  const [pickguardSourceMode, setPickguardSourceMode] =
    useState<PickguardSourceMode>("single");
  const displayPhoto = manualResultPhoto ?? sourcePhoto ?? photo;

  async function handleFile(file: File | undefined) {
    setError(null);
    setCutout({ status: "idle", progress: 0 });
    setManualOpen(false);
    setManualPoints([]);
    setManualMode("outline");
    setManualTargetPoint(null);
    setManualSegmentPreview(null);
    setManualPreviewLoading(false);
    setManualResultPhoto(null);
    setManualResultHistory([]);
    previewRequestRef.current += 1;
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

    if (pickguardSourceMode === "guitar") {
      setManualOpen(true);
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

  async function handleApplyPointSegmentedManualCutout() {
    if (!sourcePhoto || manualPoints.length < 3 || !manualTargetPoint) return;

    setError(null);
    setManualApplying(true);
    setCutout({ status: "removing", progress: 0 });
    try {
      const { createPointSegmentedManualCutout } = await import(
        "@/lib/pickguard/manualCutout"
      );
      const manualPhoto = await createPointSegmentedManualCutout(
        sourcePhoto,
        manualPoints,
        manualTargetPoint,
        {
          onProgress: handleCutoutProgress,
        },
      );
      onPhotoLoaded(manualPhoto);
      setManualResultPhoto(manualPhoto);
      setManualResultHistory([]);
      setCutout({ status: "manualDone", progress: 100 });
      setManualOpen(false);
    } catch {
      setCutout({ status: "error", progress: 0 });
      setError("Point segmentation failed. Pick a clearer point on the pickguard.");
    } finally {
      setManualApplying(false);
    }
  }

  async function handleTargetPointChange(point: Point) {
    setManualTargetPoint(point);
    setManualSegmentPreview(null);

    if (!sourcePhoto) return;

    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setManualPreviewLoading(true);
    setError(null);

    try {
      const { createPointSegmentationPreview } = await import(
        "@/lib/pickguard/manualCutout"
      );
      const preview = await createPointSegmentationPreview(sourcePhoto, point, {
        clipPoints: manualPoints,
      });

      if (previewRequestRef.current === requestId) {
        setManualSegmentPreview(preview);
      }
    } catch {
      if (previewRequestRef.current === requestId) {
        setError("Point preview failed. Pick another clear point on the pickguard.");
      }
    } finally {
      if (previewRequestRef.current === requestId) {
        setManualPreviewLoading(false);
      }
    }
  }

  async function handleResultEraseStroke(stroke: EraseStroke) {
    if (!manualResultPhoto) return;

    setResultEraseApplying(true);
    setError(null);
    try {
      const nextPhoto = await erasePhotoPixels(manualResultPhoto, stroke);
      setManualResultHistory((history) => [...history, manualResultPhoto]);
      setManualResultPhoto(nextPhoto);
      onPhotoLoaded(nextPhoto);
    } catch {
      setError("Erase failed. Please try a shorter stroke.");
    } finally {
      setResultEraseApplying(false);
    }
  }

  function handleResultEraseUndo() {
    setManualResultHistory((history) => {
      const previousPhoto = history.at(-1);
      if (!previousPhoto) return history;

      setManualResultPhoto(previousPhoto);
      onPhotoLoaded(previousPhoto);
      return history.slice(0, -1);
    });
  }

  return (
    <section className="panel">
      <h2>{title}</h2>
      {allowPickguardSourceMode ? (
        <div className="source-mode-row">
          <button
            aria-pressed={pickguardSourceMode === "single"}
            className={`source-mode-option ${
              pickguardSourceMode === "single" ? "is-selected" : ""
            }`}
            disabled={cutout.status === "removing"}
            type="button"
            onClick={() => setPickguardSourceMode("single")}
          >
            <span className="source-mode-copy">
              <span className="source-mode-title">
                Single pickguard image
                <span className="source-mode-recommendation">Recommended</span>
              </span>
            </span>
            <span className="source-mode-preview" aria-hidden>
              <span className="source-mode-example source-mode-pickguard-example">
                <span />
              </span>
            </span>
          </button>
          <button
            aria-pressed={pickguardSourceMode === "guitar"}
            className={`source-mode-option ${
              pickguardSourceMode === "guitar" ? "is-selected" : ""
            }`}
            disabled={cutout.status === "removing"}
            type="button"
            onClick={() => setPickguardSourceMode("guitar")}
          >
            <span className="source-mode-copy">
              <span className="source-mode-title">Guitar photo (with pickguard)</span>
            </span>
            <span className="source-mode-preview" aria-hidden>
              <span className="source-mode-example source-mode-guitar-example">
                <span />
              </span>
            </span>
          </button>
        </div>
      ) : null}
      <label className="upload-drop" suppressHydrationWarning>
        {cutout.status === "removing" ? (
          <LoaderCircle aria-hidden className="spin-icon" size={22} />
        ) : removeBackground && pickguardSourceMode === "single" ? (
          <WandSparkles aria-hidden size={22} />
        ) : (
          <ImageUp aria-hidden size={22} />
        )}
        <span>{displayPhoto ? replaceLabel : emptyLabel}</span>
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
          <div className="manual-outline-help">
            <button
              aria-describedby="manual-outline-example-caption"
              className="manual-outline-toggle"
              disabled={cutout.status === "removing"}
              type="button"
              onClick={() => setManualOpen((isOpen) => !isOpen)}
            >
              <Scissors aria-hidden size={17} />
              Manual outline
            </button>
            <div className="manual-outline-example" role="tooltip">
              <svg
                aria-hidden
                className="manual-outline-example-art"
                viewBox="0 0 220 132"
              >
                <rect className="manual-outline-example-bg" height="132" width="220" />
                <path
                  className="manual-outline-example-guitar"
                  d="M37 18 C18 34 25 83 47 108 C80 134 151 127 179 101 C205 74 197 31 169 19 C145 9 126 34 110 39 C90 44 69 5 37 18 Z"
                />
                <path
                  className="manual-outline-example-guard"
                  d="M75 33 C58 42 55 78 73 93 C94 111 151 104 166 82 C181 58 161 31 134 36 C116 39 105 53 91 46 C84 43 82 34 75 33 Z"
                />
                <polyline
                  className="manual-outline-example-line"
                  points="73,31 112,35 156,42 172,70 159,100 103,108 64,88 57,55 73,31"
                />
                {[
                  [73, 31],
                  [112, 35],
                  [156, 42],
                  [172, 70],
                  [159, 100],
                  [103, 108],
                  [64, 88],
                  [57, 55],
                ].map(([cx, cy], index) => (
                  <circle
                    className={
                      index === 0
                        ? "manual-outline-example-point is-start"
                        : "manual-outline-example-point"
                    }
                    cx={cx}
                    cy={cy}
                    key={`${cx}-${cy}`}
                    r={index === 0 ? 5 : 4}
                  />
                ))}
                <circle className="manual-outline-example-target" cx="115" cy="71" r="6" />
              </svg>
              <p id="manual-outline-example-caption">
                Click the first point to close, then click inside.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {manualOpen && sourcePhoto ? (
        <ManualCutoutEditor
          applying={manualApplying}
          mode={manualMode}
          photo={sourcePhoto}
          points={manualPoints}
          previewLoading={manualPreviewLoading}
          segmentPreview={manualSegmentPreview}
          targetPoint={manualTargetPoint}
          onApplySegment={handleApplyPointSegmentedManualCutout}
          onClear={() => {
            setManualPoints([]);
            setManualTargetPoint(null);
            setManualSegmentPreview(null);
            setManualPreviewLoading(false);
            previewRequestRef.current += 1;
            setManualMode("outline");
          }}
          onPointAdd={(point) => {
            setManualTargetPoint(null);
            setManualSegmentPreview(null);
            setManualPreviewLoading(false);
            previewRequestRef.current += 1;
            setManualPoints((currentPoints) => [...currentPoints, point]);
          }}
          onModeChange={setManualMode}
          onTargetPointChange={(point) => void handleTargetPointChange(point)}
          onUndo={() => {
            setManualSegmentPreview(null);
            setManualPreviewLoading(false);
            previewRequestRef.current += 1;
            if (manualTargetPoint) {
              setManualTargetPoint(null);
              return;
            }
            if (manualMode === "target") {
              setManualMode("outline");
              return;
            }
            setManualPoints((currentPoints) => currentPoints.slice(0, -1));
          }}
        />
      ) : null}
      {manualResultPhoto ? (
        <ResultCleanupEditor
          applying={resultEraseApplying}
          canUndo={manualResultHistory.length > 0}
          eraseRadiusPx={resultEraseRadius}
          photo={manualResultPhoto}
          onEraseRadiusChange={setResultEraseRadius}
          onEraseStrokeComplete={(stroke) => void handleResultEraseStroke(stroke)}
          onEraseUndo={handleResultEraseUndo}
        />
      ) : null}
      {displayPhoto ? (
        <p className="file-meta">
          {displayPhoto.name} - {displayPhoto.width} x {displayPhoto.height}px
        </p>
      ) : null}
      {error ? <p className="helper-text">{error}</p> : null}
    </section>
  );
}

function CutoutStatus({ state }: { state: CutoutState }) {
  if (state.status === "idle") {
    return null;
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
    return <p className="helper-text">Pickguard cutout loaded. Use cleanup only if needed.</p>;
  }

  return null;
}

type ManualCutoutEditorProps = {
  applying: boolean;
  mode: ManualMode;
  photo: UploadedPhoto;
  points: Point[];
  previewLoading: boolean;
  segmentPreview: UploadedPhoto | null;
  targetPoint: Point | null;
  onApplySegment: () => void;
  onClear: () => void;
  onModeChange: (mode: ManualMode) => void;
  onPointAdd: (point: Point) => void;
  onTargetPointChange: (point: Point) => void;
  onUndo: () => void;
};

function ManualCutoutEditor({
  applying,
  mode,
  photo,
  points,
  previewLoading,
  segmentPreview,
  targetPoint,
  onApplySegment,
  onClear,
  onModeChange,
  onPointAdd,
  onTargetPointChange,
  onUndo,
}: ManualCutoutEditorProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);

  function getPhotoClick(event: ReactPointerEvent<HTMLDivElement>) {
    const frame = frameRef.current;
    if (!frame) return null;

    const rect = frame.getBoundingClientRect();
    return {
      point: {
        x: clamp(((event.clientX - rect.left) / rect.width) * photo.width, 0, photo.width),
        y: clamp(((event.clientY - rect.top) / rect.height) * photo.height, 0, photo.height),
      },
      rect,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const click = getPhotoClick(event);
    if (!click) return;

    const { point, rect } = click;

    if (mode === "target") {
      onTargetPointChange(point);
      return;
    }

    if (
      points.length >= 3 &&
      points[0] &&
      isNearFirstPoint(point, points[0], photo, rect)
    ) {
      onModeChange("target");
      return;
    }

    onPointAdd(point);
  }

  const svgPoints = points
    .map((point) => `${(point.x / photo.width) * 100},${(point.y / photo.height) * 100}`)
    .join(" ");
  const helperText = targetPoint
    ? "Ready to cut out."
    : mode === "target"
      ? "Click inside the pickguard."
      : points.length >= 3
        ? "Click the first point to close the outline, then click inside the pickguard."
        : "Draw around the pickguard edge. When the outline surrounds it, click inside the pickguard.";

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
        {segmentPreview ? (
          <img
            alt=""
            className="manual-segment-preview"
            draggable={false}
            src={segmentPreview.dataUrl}
          />
        ) : null}
        {previewLoading ? (
          <div className="manual-preview-loading" aria-hidden>
            <LoaderCircle className="spin-icon" size={18} />
          </div>
        ) : null}
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none">
          {points.length > 1 ? (
            mode === "target" && points.length > 2 ? (
              <polygon className="manual-cutout-line" points={svgPoints} />
            ) : (
              <polyline className="manual-cutout-line" points={svgPoints} />
            )
          ) : null}
          {points.length > 2 ? (
            <polygon className="manual-cutout-fill" points={svgPoints} />
          ) : null}
          {points.map((point, index) => (
            <circle
              className={
                index === 0 && points.length >= 3 && mode === "outline"
                  ? "manual-cutout-point is-close-handle"
                  : "manual-cutout-point"
              }
              cx={(point.x / photo.width) * 100}
              cy={(point.y / photo.height) * 100}
              key={`${point.x}-${point.y}-${index}`}
              r={index === 0 && points.length >= 3 && mode === "outline" ? "1.8" : "1.35"}
            />
          ))}
          {targetPoint ? (
            <circle
              className="manual-target-point"
              cx={(targetPoint.x / photo.width) * 100}
              cy={(targetPoint.y / photo.height) * 100}
              r="1.9"
            />
          ) : null}
        </svg>
      </div>
      <p className="helper-text">{helperText}</p>
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
          className="primary-button manual-segment-button"
          disabled={points.length < 3 || !targetPoint || applying || previewLoading}
          type="button"
          onClick={onApplySegment}
        >
          <WandSparkles aria-hidden size={17} />
          Cut out pickguard
        </button>
      </div>
    </div>
  );
}

function isNearFirstPoint(
  point: Point,
  firstPoint: Point,
  photo: UploadedPhoto,
  rect: DOMRect,
) {
  const dx = ((point.x - firstPoint.x) / photo.width) * rect.width;
  const dy = ((point.y - firstPoint.y) / photo.height) * rect.height;
  return Math.hypot(dx, dy) <= 24;
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

type ResultCleanupEditorProps = {
  applying: boolean;
  canUndo: boolean;
  eraseRadiusPx: number;
  photo: UploadedPhoto;
  onEraseRadiusChange: (radiusPx: number) => void;
  onEraseStrokeComplete: (stroke: EraseStroke) => void;
  onEraseUndo: () => void;
};

function ResultCleanupEditor({
  applying,
  canUndo,
  eraseRadiusPx,
  photo,
  onEraseRadiusChange,
  onEraseStrokeComplete,
  onEraseUndo,
}: ResultCleanupEditorProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [activeErasePoints, setActiveErasePoints] = useState<Point[]>([]);

  function getPhotoPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const frame = frameRef.current;
    if (!frame) return null;

    const rect = frame.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * photo.width, 0, photo.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * photo.height, 0, photo.height),
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const point = getPhotoPoint(event);
    if (!point || applying) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveErasePoints([point]);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (activeErasePoints.length === 0 || applying) return;

    const point = getPhotoPoint(event);
    if (!point) return;

    setActiveErasePoints((currentPoints) =>
      appendErasePoint(currentPoints, point, eraseRadiusPx),
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const point = getPhotoPoint(event);
    finishEraseStroke(point);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function finishEraseStroke(point?: Point | null) {
    setActiveErasePoints((currentPoints) => {
      const nextPoints = point
        ? appendErasePoint(currentPoints, point, eraseRadiusPx)
        : currentPoints;

      if (nextPoints.length > 0) {
        onEraseStrokeComplete({ points: nextPoints, radiusPx: eraseRadiusPx });
      }

      return [];
    });
  }

  const activeStroke = activeErasePoints
    .map((point) => `${(point.x / photo.width) * 100},${(point.y / photo.height) * 100}`)
    .join(" ");
  const activeStrokeWidth = Math.max(
    0.9,
    (eraseRadiusPx / Math.max(photo.width, photo.height)) * 200,
  );

  return (
    <div className="manual-cutout-editor result-cleanup-editor">
      <div className="result-cleanup-header">
        <span>
          <Eraser aria-hidden size={17} />
          Erase outside
        </span>
        <button
          className="icon-button"
          disabled={!canUndo || applying}
          title="Undo erase"
          type="button"
          onClick={onEraseUndo}
        >
          <Undo2 aria-hidden size={17} />
        </button>
      </div>
      <div
        aria-label="Pickguard result cleanup editor"
        className="manual-cutout-frame is-erasing"
        ref={frameRef}
        role="button"
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        tabIndex={0}
        onPointerCancel={() => finishEraseStroke()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <img alt="Generated pickguard cutout" draggable={false} src={photo.dataUrl} />
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none">
          {activeStroke ? (
            activeStroke.includes(" ") ? (
              <polyline
                className="manual-erase-stroke"
                points={activeStroke}
                strokeWidth={activeStrokeWidth}
              />
            ) : (
              <circle
                className="manual-erase-stroke"
                cx={activeStroke.split(",")[0]}
                cy={activeStroke.split(",")[1]}
                r={activeStrokeWidth / 2}
              />
            )
          ) : null}
        </svg>
      </div>
      <label className="field manual-erase-size">
        <span>Erase size</span>
        <input
          max="80"
          min="8"
          step="2"
          type="range"
          value={eraseRadiusPx}
          onChange={(event) => onEraseRadiusChange(Number(event.target.value))}
        />
      </label>
    </div>
  );
}

async function erasePhotoPixels(photo: UploadedPhoto, stroke: EraseStroke) {
  const image = await loadImage(photo.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(photo.width);
  canvas.height = Math.round(photo.height);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Could not create cleanup canvas.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.save();
  context.globalCompositeOperation = "destination-out";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = stroke.radiusPx * 2;
  context.strokeStyle = "rgba(0, 0, 0, 1)";
  context.fillStyle = "rgba(0, 0, 0, 1)";

  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    context.beginPath();
    context.arc(point.x, point.y, stroke.radiusPx, 0, Math.PI * 2);
    context.fill();
  } else if (stroke.points.length > 1) {
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const point of stroke.points.slice(1)) {
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  }

  context.restore();

  return {
    ...photo,
    dataUrl: canvas.toDataURL("image/png"),
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the cutout image."));
    image.src = src;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function appendErasePoint(points: Point[], point: Point, radiusPx: number) {
  const previousPoint = points.at(-1);
  if (!previousPoint) return [point];

  const minimumDistance = Math.max(2, radiusPx / 4);
  const distance = Math.hypot(previousPoint.x - point.x, previousPoint.y - point.y);

  if (distance < minimumDistance) return points;
  return [...points, point];
}
