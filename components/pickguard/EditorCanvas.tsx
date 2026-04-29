"use client";

import { RotateCcw } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  clampStringGuidePoint,
  getInitialStringOverlay,
  getPickguardBaseSize,
  getInitialStickerTransform,
  getStickerBaseSize,
  type Point,
  type PickguardTransform,
  type StickerTransform,
  type StringOverlay,
  type UploadedPhoto,
} from "@/lib/pickguard/geometry";
import type { GeneratedDesign } from "@/lib/pickguard/patternGenerator";
import { parseViewBox, type PickguardTemplate } from "@/lib/pickguard/templates";

type EditorCanvasProps = {
  photo: UploadedPhoto | null;
  pickguardPhoto: UploadedPhoto | null;
  template: PickguardTemplate;
  design: GeneratedDesign | null;
  transform: PickguardTransform;
  stickerTransform: StickerTransform;
  stringOverlay: StringOverlay | null;
  onTransformChange: (transform: PickguardTransform) => void;
  onStickerTransformChange: (transform: StickerTransform) => void;
  onStringOverlayChange: (overlay: StringOverlay) => void;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startTransform: PickguardTransform;
};

type StringDragState = {
  pointerId: number;
  handle: "start" | "end";
};

export function EditorCanvas({
  photo,
  pickguardPhoto,
  template,
  design,
  transform,
  stickerTransform,
  stringOverlay,
  onTransformChange,
  onStickerTransformChange,
  onStringOverlayChange,
}: EditorCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const stringDragRef = useRef<StringDragState | null>(null);
  const [stageWidth, setStageWidth] = useState(900);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setStageWidth(width);
    });
    observer.observe(stage);

    return () => observer.disconnect();
  }, []);

  const ratio = photo ? stageWidth / photo.width : 1;
  const base = useMemo(
    () => (photo ? getPickguardBaseSize(template, photo) : null),
    [photo, template],
  );
  const stickerBase = useMemo(
    () =>
      photo && pickguardPhoto
        ? getStickerBaseSize(pickguardPhoto, photo)
        : null,
    [photo, pickguardPhoto],
  );
  const viewBox = parseViewBox(template.viewBox);
  const clipId = `editor-clip-${template.id}`;

  useEffect(() => {
    if (!photo || !stringOverlay) return;

    const hasOldEndpoint =
      !("extension" in stringOverlay) ||
      stringOverlay.end.y > photo.height * 0.46;

    if (!hasOldEndpoint) return;

    const initial = getInitialStringOverlay(photo);
    onStringOverlayChange({
      ...stringOverlay,
      start: initial.start,
      end: initial.end,
      extension: initial.extension,
    });
  }, [photo, stringOverlay, onStringOverlayChange]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!photo) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTransform: transform,
    };
  }

  function handleStickerPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!photo) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTransform: stickerTransform,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!photo || !drag || drag.pointerId !== event.pointerId) return;

    const dx = (event.clientX - drag.startClientX) / ratio;
    const dy = (event.clientY - drag.startClientY) / ratio;
    onTransformChange({
      ...drag.startTransform,
      x: drag.startTransform.x + dx,
      y: drag.startTransform.y + dy,
    });
  }

  function handleStickerPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!photo || !drag || drag.pointerId !== event.pointerId) return;

    const dx = (event.clientX - drag.startClientX) / ratio;
    const dy = (event.clientY - drag.startClientY) / ratio;
    onStickerTransformChange({
      ...drag.startTransform,
      x: drag.startTransform.x + dx,
      y: drag.startTransform.y + dy,
    });
  }

  function stopDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function toPhotoPoint(clientX: number, clientY: number): Point | null {
    const stage = stageRef.current;
    if (!photo || !stage) return null;
    const rect = stage.getBoundingClientRect();

    return {
      x: clamp((clientX - rect.left) / ratio, 0, photo.width),
      y: clamp((clientY - rect.top) / ratio, 0, photo.height),
    };
  }

  function toStringGuidePoint(clientX: number, clientY: number): Point | null {
    const point = toPhotoPoint(clientX, clientY);
    if (!photo || !point) return null;

    return clampStringGuidePoint(photo, point);
  }

  function handleStringPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: "start" | "end",
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    stringDragRef.current = { pointerId: event.pointerId, handle };
  }

  function handleStringPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = stringDragRef.current;
    if (!drag || !stringOverlay || drag.pointerId !== event.pointerId) return;
    const nextPoint = toStringGuidePoint(event.clientX, event.clientY);
    if (!nextPoint) return;

    onStringOverlayChange({
      ...stringOverlay,
      [drag.handle]: nextPoint,
    });
  }

  function stopStringDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (stringDragRef.current?.pointerId === event.pointerId) {
      stringDragRef.current = null;
    }
  }

  return (
    <section className="editor-panel" aria-label="Pickguard preview editor">
      <div className="stage-wrap">
        {photo ? (
          <div
            className="editor-stage"
            ref={stageRef}
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
            onPointerCancel={stopStringDrag}
            onPointerMove={handleStringPointerMove}
            onPointerUp={stopStringDrag}
          >
            <img
              alt="Uploaded guitar"
              className="photo-layer"
              draggable={false}
              src={photo.dataUrl}
            />
            {pickguardPhoto && stickerBase ? (
              <div
                className="pickguard-photo-overlay"
                role="button"
                tabIndex={0}
                style={{
                  left: stickerTransform.x * ratio,
                  top: stickerTransform.y * ratio,
                  width: stickerBase.width * ratio,
                  height: stickerBase.height * ratio,
                  transform: `translate(-50%, -50%) rotate(${stickerTransform.rotation}deg) scale(${stickerTransform.scale})`,
                }}
                onPointerCancel={stopDrag}
                onPointerDown={handleStickerPointerDown}
                onPointerMove={handleStickerPointerMove}
                onPointerUp={stopDrag}
              >
                <img
                  alt="Uploaded pickguard"
                  draggable={false}
                  src={pickguardPhoto.dataUrl}
                />
                {design ? (
                  <img
                    alt=""
                    className="pickguard-pattern-fill"
                    draggable={false}
                    style={{
                      WebkitMaskImage: `url(${pickguardPhoto.dataUrl})`,
                      WebkitMaskPosition: "center",
                      WebkitMaskRepeat: "no-repeat",
                      WebkitMaskSize: "100% 100%",
                      maskImage: `url(${pickguardPhoto.dataUrl})`,
                      maskPosition: "center",
                      maskRepeat: "no-repeat",
                      maskSize: "100% 100%",
                    }}
                    src={design.imageDataUrl}
                  />
                ) : null}
                <span className="transform-handle handle-nw" />
                <span className="transform-handle handle-ne" />
                <span className="transform-handle handle-sw" />
                <span className="transform-handle handle-se" />
              </div>
            ) : null}
            {design && base && !pickguardPhoto ? (
              <div
                className="pickguard-overlay"
                role="button"
                tabIndex={0}
                style={{
                  left: transform.x * ratio,
                  top: transform.y * ratio,
                  width: base.width * ratio,
                  height: base.height * ratio,
                  transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.scale})`,
                }}
                onPointerCancel={stopDrag}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDrag}
              >
                <svg viewBox={template.viewBox} aria-hidden>
                  <defs>
                    <clipPath id={clipId}>
                      <path d={template.outerPath} />
                    </clipPath>
                  </defs>
                  <image
                    clipPath={`url(#${clipId})`}
                    height={viewBox.height}
                    href={design.imageDataUrl}
                    preserveAspectRatio="xMidYMid slice"
                    width={viewBox.width}
                    x={viewBox.minX}
                    y={viewBox.minY}
                  />
                  <path
                    d={template.outerPath}
                    fill="none"
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth="8"
                  />
                  {template.holes.map((hole, index) => (
                    <circle
                      cx={hole.x}
                      cy={hole.y}
                      fill="rgba(255,255,255,0.64)"
                      key={`${hole.x}-${hole.y}-${index}`}
                      r={hole.r}
                      stroke="#111"
                      strokeWidth="5"
                    />
                  ))}
                </svg>
                <span className="transform-handle handle-nw" />
                <span className="transform-handle handle-ne" />
                <span className="transform-handle handle-sw" />
                <span className="transform-handle handle-se" />
              </div>
            ) : null}
            {pickguardPhoto && stringOverlay?.enabled ? (
              <StringOverlayLayer
                overlay={stringOverlay}
                ratio={ratio}
                onHandlePointerDown={handleStringPointerDown}
              />
            ) : null}
          </div>
        ) : (
          <div className="empty-stage">
            <div>
              <h2>Upload a guitar photo to start</h2>
              <p className="helper-text">
                The selected pickguard design will appear here for manual
                alignment.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="editor-controls">
        <label className="field">
          <span>Scale pickguard</span>
          <input
            disabled={!photo || !pickguardPhoto}
            max="2.5"
            min="0.35"
            step="0.01"
            type="range"
            value={pickguardPhoto ? stickerTransform.scale : transform.scale}
            onChange={(event) =>
              onStickerTransformChange({
                ...stickerTransform,
                scale: Number(event.target.value),
              })
            }
          />
        </label>
        <label className="field">
          <span>Rotate pickguard</span>
          <input
            disabled={!photo || !pickguardPhoto}
            max="180"
            min="-180"
            step="1"
            type="range"
            value={pickguardPhoto ? stickerTransform.rotation : transform.rotation}
            onChange={(event) =>
              onStickerTransformChange({
                ...stickerTransform,
                rotation: Number(event.target.value),
              })
            }
          />
        </label>
        <button
          className="secondary-button"
          disabled={!photo || !pickguardPhoto}
          type="button"
          onClick={() =>
            photo && onStickerTransformChange(getInitialStickerTransform(photo))
          }
        >
          <RotateCcw aria-hidden size={17} />
          Reset
        </button>
      </div>

      {photo && pickguardPhoto && stringOverlay ? (
        <div className="string-controls">
          <label className="field checkbox-field">
            <input
              checked={stringOverlay.enabled}
              type="checkbox"
              onChange={(event) =>
                onStringOverlayChange({
                  ...stringOverlay,
                  enabled: event.target.checked,
                })
              }
            />
            <span>Show virtual strings</span>
          </label>
          <label className="field">
            <span>Strings</span>
            <select
              disabled={!stringOverlay.enabled}
              value={stringOverlay.count}
              onChange={(event) =>
                onStringOverlayChange({
                  ...stringOverlay,
                  count: Number(event.target.value),
                })
              }
            >
              <option value={4}>4 strings</option>
              <option value={5}>5 strings</option>
              <option value={6}>6 strings</option>
              <option value={7}>7 strings</option>
            </select>
          </label>
          <label className="field">
            <span>String spread</span>
            <input
              disabled={!stringOverlay.enabled}
              max={photo.width * 0.42}
              min="24"
              step="1"
              type="range"
              value={stringOverlay.spread}
              onChange={(event) =>
                onStringOverlayChange({
                  ...stringOverlay,
                  spread: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="field">
            <span>String opacity</span>
            <input
              disabled={!stringOverlay.enabled}
              max="1"
              min="0.2"
              step="0.01"
              type="range"
              value={stringOverlay.opacity}
              onChange={(event) =>
                onStringOverlayChange({
                  ...stringOverlay,
                  opacity: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}

type StringOverlayLayerProps = {
  overlay: StringOverlay;
  ratio: number;
  onHandlePointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: "start" | "end",
  ) => void;
};

function StringOverlayLayer({
  overlay,
  ratio,
  onHandlePointerDown,
}: StringOverlayLayerProps) {
  const lines = getStringLines(overlay);

  return (
    <div className="string-overlay" aria-hidden>
      <svg>
        <g opacity={overlay.opacity}>
          {lines.map((line, index) => (
            <line
              className="string-shadow"
              key={`shadow-${index}`}
              strokeWidth={(overlay.width + 1.2) * ratio}
              x1={line.x1 * ratio}
              x2={line.x2 * ratio}
              y1={line.y1 * ratio}
              y2={line.y2 * ratio}
            />
          ))}
          {lines.map((line, index) => (
            <line
              className="string-line"
              key={`line-${index}`}
              strokeWidth={overlay.width * ratio}
              x1={line.x1 * ratio}
              x2={line.x2 * ratio}
              y1={line.y1 * ratio}
              y2={line.y2 * ratio}
            />
          ))}
        </g>
      </svg>
      <button
        aria-label="Move top string guide"
        className="string-handle string-handle-start"
        style={{
          left: overlay.start.x * ratio,
          top: overlay.start.y * ratio,
        }}
        type="button"
        onPointerDown={(event) => onHandlePointerDown(event, "start")}
      />
      <button
        aria-label="Move bottom string guide"
        className="string-handle string-handle-end"
        style={{
          left: overlay.end.x * ratio,
          top: overlay.end.y * ratio,
        }}
        type="button"
        onPointerDown={(event) => onHandlePointerDown(event, "end")}
      />
    </div>
  );
}

function getStringLines(overlay: StringOverlay) {
  const dx = overlay.end.x - overlay.start.x;
  const dy = overlay.end.y - overlay.start.y;
  const length = Math.hypot(dx, dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;
  const normalX = -dy / length;
  const normalY = dx / length;
  const spacing = overlay.count > 1 ? overlay.spread / (overlay.count - 1) : 0;
  const extension = overlay.extension ?? 0;

  return Array.from({ length: overlay.count }, (_, index) => {
    const offset = (index - (overlay.count - 1) / 2) * spacing;

    return {
      x1: overlay.start.x + normalX * offset - unitX * extension,
      y1: overlay.start.y + normalY * offset - unitY * extension,
      x2: overlay.end.x + normalX * offset + unitX * extension,
      y2: overlay.end.y + normalY * offset + unitY * extension,
    };
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
