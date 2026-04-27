import { parseViewBox, type PickguardTemplate } from "./templates";

export type UploadedPhoto = {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
};

export type PickguardTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type StickerTransform = PickguardTransform;

export type Point = {
  x: number;
  y: number;
};

export type StringOverlay = {
  enabled: boolean;
  count: number;
  start: Point;
  end: Point;
  spread: number;
  opacity: number;
  width: number;
  extension: number;
};

export function getPickguardBaseSize(
  template: PickguardTemplate,
  photo: PickguardImageBounds,
) {
  const viewBox = parseViewBox(template.viewBox);
  const width = Math.max(140, Math.min(photo.width * 0.38, 560));
  const height = width * (viewBox.height / viewBox.width);

  return { width, height };
}

type PickguardImageBounds = {
  width: number;
  height: number;
};

export function getInitialTransform(photo: PickguardImageBounds) {
  return {
    x: photo.width * 0.48,
    y: photo.height * 0.48,
    scale: 1,
    rotation: 0,
  };
}

export function getInitialStickerTransform(photo: PickguardImageBounds) {
  return {
    x: photo.width * 0.5,
    y: photo.height * 0.5,
    scale: 1,
    rotation: 0,
  };
}

export function getStickerBaseSize(
  sticker: PickguardImageBounds,
  photo: PickguardImageBounds,
) {
  const width = Math.max(120, Math.min(photo.width * 0.42, 560));
  const height = width * (sticker.height / sticker.width);

  return { width, height };
}

export function getInitialStringOverlay(photo: PickguardImageBounds): StringOverlay {
  return {
    enabled: true,
    count: 6,
    start: { x: round(photo.width * 0.52), y: round(photo.height * 0.34) },
    end: { x: round(photo.width * 0.46), y: round(photo.height * 0.44) },
    spread: Math.max(54, photo.width * 0.16),
    opacity: 0.78,
    width: Math.max(1.4, photo.width * 0.0022),
    extension: Math.max(photo.width, photo.height) * 0.55,
  };
}

export function clampStringGuidePoint(
  photo: PickguardImageBounds,
  point: Point,
): Point {
  return {
    x: clamp(point.x, 0, photo.width),
    y: clamp(point.y, photo.height * 0.18, photo.height * 0.52),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
