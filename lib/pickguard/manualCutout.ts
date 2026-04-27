import type {
  InteractiveSegmenter as InteractiveSegmenterTask,
  MPMask,
} from "@mediapipe/tasks-vision";

import type { Point, UploadedPhoto } from "./geometry";
import {
  blobToDataUrl,
  removeImageBackground,
  type BackgroundRemovalProgress,
} from "./backgroundRemoval";

export type ManualCutoutBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageBounds = {
  width: number;
  height: number;
};

type ManualCutoutOptions = {
  insetPx?: number;
};

type SegmentedManualCutoutOptions = ManualCutoutOptions & {
  onProgress?: (progress: BackgroundRemovalProgress) => void;
  refineBandPx?: number;
};

type PointSegmentedManualCutoutOptions = ManualCutoutOptions & {
  edgeFringePx?: number;
  onProgress?: (progress: BackgroundRemovalProgress) => void;
  threshold?: number;
};

type PointSegmentationPreviewOptions = {
  clipPoints?: Point[];
  insetPx?: number;
  threshold?: number;
};

type SourceImageSize = {
  width: number;
  height: number;
};

type SegmentationMask = {
  data: Float32Array | Uint8Array;
  width: number;
  height: number;
};

type PreviewColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const POINT_SEGMENTATION_PREVIEW_COLOR: PreviewColor = {
  r: 56,
  g: 189,
  b: 248,
  a: 94,
};

let interactiveSegmenterPromise: Promise<InteractiveSegmenterTask> | null = null;

export function getManualCutoutBounds(
  image: ImageBounds,
  points: Point[],
  padding = 0,
): ManualCutoutBounds | null {
  if (points.length < 3) return null;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = clamp(Math.min(...xs) - padding, 0, image.width);
  const minY = clamp(Math.min(...ys) - padding, 0, image.height);
  const maxX = clamp(Math.max(...xs) + padding, 0, image.width);
  const maxY = clamp(Math.max(...ys) + padding, 0, image.height);

  return {
    x: round(minX),
    y: round(minY),
    width: Math.max(1, round(maxX - minX)),
    height: Math.max(1, round(maxY - minY)),
  };
}

export async function createManualCutout(
  sourcePhoto: UploadedPhoto,
  points: Point[],
  options: ManualCutoutOptions = {},
): Promise<UploadedPhoto> {
  const candidate = await createManualCutoutCandidate(sourcePhoto, points, options);

  return buildManualCutoutPhoto(
    sourcePhoto,
    candidate.canvas.toDataURL("image/png"),
    candidate.bounds,
  );
}

export async function createConstrainedSegmentedManualCutout(
  sourcePhoto: UploadedPhoto,
  points: Point[],
  optionsOrProgress?:
    | SegmentedManualCutoutOptions
    | ((progress: BackgroundRemovalProgress) => void),
): Promise<UploadedPhoto> {
  const options =
    typeof optionsOrProgress === "function"
      ? { onProgress: optionsOrProgress }
      : (optionsOrProgress ?? {});
  const candidate = await createManualCutoutCandidate(sourcePhoto, points, {
    insetPx: options.insetPx,
  });
  const roughBlob = await canvasToBlob(candidate.canvas);
  const segmentedBlob = await removeImageBackground(roughBlob, options.onProgress);
  const segmentedCanvas = await imageDataUrlToCanvas(await blobToDataUrl(segmentedBlob));

  applyConstrainedSegmentationToCanvas(
    candidate.canvas,
    segmentedCanvas,
    options.refineBandPx ?? 48,
  );

  return buildConstrainedSegmentedManualCutoutPhoto(
    sourcePhoto,
    candidate.canvas.toDataURL("image/png"),
    candidate.bounds,
  );
}

export async function createPointSegmentedManualCutout(
  sourcePhoto: UploadedPhoto,
  points: Point[],
  targetPoint: Point,
  optionsOrProgress?:
    | PointSegmentedManualCutoutOptions
    | ((progress: BackgroundRemovalProgress) => void),
): Promise<UploadedPhoto> {
  const options =
    typeof optionsOrProgress === "function"
      ? { onProgress: optionsOrProgress }
      : (optionsOrProgress ?? {});
  const candidate = await createManualCutoutCandidate(sourcePhoto, points, {
    insetPx: options.insetPx,
  });

  options.onProgress?.({ key: "interactive-segmenter", current: 0, total: 1 });
  const mask = await segmentSourcePhotoFromPoint(sourcePhoto, targetPoint);
  options.onProgress?.({ key: "interactive-segmenter", current: 1, total: 1 });

  applyPointSegmentationMaskToCanvas(
    candidate.canvas,
    candidate.bounds,
    sourcePhoto,
    mask,
    options.threshold ?? 0.5,
    options.edgeFringePx ?? 12,
  );

  return buildPointSegmentedManualCutoutPhoto(
    sourcePhoto,
    candidate.canvas.toDataURL("image/png"),
    candidate.bounds,
  );
}

export async function createPointSegmentationPreview(
  sourcePhoto: UploadedPhoto,
  targetPoint: Point,
  options: PointSegmentationPreviewOptions = {},
): Promise<UploadedPhoto> {
  const mask = await segmentSourcePhotoFromPoint(sourcePhoto, targetPoint);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourcePhoto.width);
  canvas.height = Math.round(sourcePhoto.height);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas cutout is not available in this browser.");
  }

  const imageData = context.createImageData(canvas.width, canvas.height);
  const clipPoints = options.clipPoints
    ? getInsetPolygonPoints(options.clipPoints, options.insetPx ?? 0)
    : undefined;
  applyPointSegmentationPreviewPixels(
    imageData.data,
    canvas.width,
    canvas.height,
    sourcePhoto,
    mask,
    options.threshold ?? 0.5,
    undefined,
    clipPoints,
  );
  context.putImageData(imageData, 0, 0);

  return buildPointSegmentationPreviewPhoto(
    sourcePhoto,
    canvas.toDataURL("image/png"),
  );
}

async function createManualCutoutCandidate(
  sourcePhoto: UploadedPhoto,
  points: Point[],
  options: ManualCutoutOptions = {},
) {
  const maskPoints = getInsetPolygonPoints(points, options.insetPx ?? 0);
  const bounds = getManualCutoutBounds(sourcePhoto, maskPoints, 2);

  if (!bounds) {
    throw new Error("Select at least three points around the pickguard.");
  }

  const image = await loadImage(sourcePhoto.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bounds.width);
  canvas.height = Math.round(bounds.height);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas cutout is not available in this browser.");
  }

  context.save();
  const relativeMaskPoints = getManualCutoutMaskPoints(maskPoints, bounds);
  drawPolygonPath(context, relativeMaskPoints);
  context.clip();
  context.drawImage(image, -bounds.x, -bounds.y);
  context.restore();

  return { bounds, canvas, maskPoints: relativeMaskPoints };
}

export function buildManualCutoutPhoto(
  sourcePhoto: Pick<UploadedPhoto, "dataUrl" | "name">,
  transparentDataUrl: string,
  bounds: ManualCutoutBounds,
): UploadedPhoto {
  return {
    dataUrl: transparentDataUrl,
    name: `${stripImageExtension(sourcePhoto.name)}-manual-cutout.png`,
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
}

export function buildConstrainedSegmentedManualCutoutPhoto(
  sourcePhoto: Pick<UploadedPhoto, "dataUrl" | "name">,
  transparentDataUrl: string,
  bounds: ManualCutoutBounds,
): UploadedPhoto {
  return {
    dataUrl: transparentDataUrl,
    name: `${stripImageExtension(sourcePhoto.name)}-constrained-segmented-cutout.png`,
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
}

export function buildPointSegmentedManualCutoutPhoto(
  sourcePhoto: Pick<UploadedPhoto, "dataUrl" | "name">,
  transparentDataUrl: string,
  bounds: ManualCutoutBounds,
): UploadedPhoto {
  return {
    dataUrl: transparentDataUrl,
    name: `${stripImageExtension(sourcePhoto.name)}-point-segmented-cutout.png`,
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
}

export function buildPointSegmentationPreviewPhoto(
  sourcePhoto: Pick<UploadedPhoto, "dataUrl" | "name" | "width" | "height">,
  transparentDataUrl: string,
): UploadedPhoto {
  return {
    dataUrl: transparentDataUrl,
    name: `${stripImageExtension(sourcePhoto.name)}-point-segmentation-preview.png`,
    width: Math.round(sourcePhoto.width),
    height: Math.round(sourcePhoto.height),
  };
}

export function getInsetPolygonPoints(points: Point[], insetPx: number): Point[] {
  if (points.length < 3 || insetPx <= 0) return points;

  const center = getCentroid(points);

  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 0) return point;

    const nextDistance = Math.max(0, distance - insetPx);
    const scale = nextDistance / distance;

    return {
      x: round(center.x + dx * scale),
      y: round(center.y + dy * scale),
    };
  });
}

function getCentroid(points: Point[]): Point {
  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

export function getManualCutoutMaskPoints(
  points: Point[],
  bounds: ManualCutoutBounds,
): Point[] {
  return points.map((point) => ({
    x: round(point.x - bounds.x),
    y: round(point.y - bounds.y),
  }));
}

export function applyConstrainedSegmentationAlpha(
  manualData: Uint8ClampedArray,
  segmentedData: Uint8ClampedArray,
  width: number,
  height: number,
  options: { refineBandPx?: number } = {},
) {
  const refineBandPx = options.refineBandPx ?? 48;
  const distances = getAlphaDistanceFromExterior(manualData, width, height);

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const alphaIndex = pixelIndex * 4 + 3;
    if (manualData[alphaIndex] < 16) continue;
    if (distances[pixelIndex] > refineBandPx) continue;

    manualData[alphaIndex] = Math.min(
      manualData[alphaIndex],
      segmentedData[alphaIndex],
    );
  }
}

export function applyPointSegmentationMaskToManualCutout(
  manualData: Uint8ClampedArray,
  cutoutWidth: number,
  cutoutHeight: number,
  bounds: ManualCutoutBounds,
  sourceSize: SourceImageSize,
  mask: SegmentationMask,
  threshold = 0.5,
) {
  for (let y = 0; y < cutoutHeight; y += 1) {
    for (let x = 0; x < cutoutWidth; x += 1) {
      const manualIndex = (y * cutoutWidth + x) * 4;
      if (manualData[manualIndex + 3] < 16) continue;

      const sourceX = bounds.x + x;
      const sourceY = bounds.y + y;
      const maskX = clamp(
        Math.floor((sourceX / sourceSize.width) * mask.width),
        0,
        mask.width - 1,
      );
      const maskY = clamp(
        Math.floor((sourceY / sourceSize.height) * mask.height),
        0,
        mask.height - 1,
      );
      const maskValue = mask.data[maskY * mask.width + maskX];

      if (maskValue < threshold) {
        manualData[manualIndex + 3] = 0;
      }
    }
  }
}

export function selectPointSegmentationMask(
  masks: SegmentationMask[],
  targetPoint: Point,
  sourceSize: SourceImageSize,
) {
  if (masks.length === 0) return null;

  let selectedMask = masks[0];
  let selectedScore = getMaskValueAtSourcePoint(
    selectedMask,
    targetPoint,
    sourceSize,
  );

  for (const mask of masks.slice(1)) {
    const score = getMaskValueAtSourcePoint(mask, targetPoint, sourceSize);
    if (score > selectedScore) {
      selectedMask = mask;
      selectedScore = score;
    }
  }

  return selectedMask;
}

export function applyPointSegmentationPreviewPixels(
  previewData: Uint8ClampedArray,
  previewWidth: number,
  previewHeight: number,
  sourceSize: SourceImageSize,
  mask: SegmentationMask,
  threshold = 0.5,
  color: PreviewColor | undefined = POINT_SEGMENTATION_PREVIEW_COLOR,
  clipPolygon?: Point[],
) {
  const previewColor = color ?? POINT_SEGMENTATION_PREVIEW_COLOR;

  for (let y = 0; y < previewHeight; y += 1) {
    for (let x = 0; x < previewWidth; x += 1) {
      const sourceX = ((x + 0.5) / previewWidth) * sourceSize.width;
      const sourceY = ((y + 0.5) / previewHeight) * sourceSize.height;
      if (
        clipPolygon &&
        !isPointInPolygon({ x: sourceX, y: sourceY }, clipPolygon)
      ) {
        continue;
      }

      const maskValue = getMaskValueAtSourcePoint(
        mask,
        { x: sourceX, y: sourceY },
        sourceSize,
      );

      if (maskValue < threshold) continue;

      const previewIndex = (y * previewWidth + x) * 4;
      previewData[previewIndex] = previewColor.r;
      previewData[previewIndex + 1] = previewColor.g;
      previewData[previewIndex + 2] = previewColor.b;
      previewData[previewIndex + 3] = previewColor.a;
    }
  }
}

export function removeNeutralEdgeFringePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: {
    maxDistancePx?: number;
    minAlpha?: number;
    minBrightness?: number;
    maxSaturation?: number;
  } = {},
) {
  const maxDistancePx = options.maxDistancePx ?? 12;
  const minAlpha = options.minAlpha ?? 16;
  const visited = new Uint8Array(width * height);
  const queue: Array<{ pixelIndex: number; distance: number }> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      if (!isNeutralFringePixel(data, pixelIndex, options)) continue;
      if (!touchesTransparentOrCanvasEdge(data, width, height, x, y, minAlpha)) {
        continue;
      }

      visited[pixelIndex] = 1;
      queue.push({ pixelIndex, distance: 0 });
    }
  }

  let removed = 0;
  let readIndex = 0;

  while (readIndex < queue.length) {
    const { pixelIndex, distance } = queue[readIndex];
    readIndex += 1;

    if (data[pixelIndex * 4 + 3] >= minAlpha) {
      data[pixelIndex * 4 + 3] = 0;
      removed += 1;
    }

    if (distance >= maxDistancePx) continue;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    for (const neighbor of getNeighborIndexes(x, y, width, height)) {
      if (visited[neighbor]) continue;
      visited[neighbor] = 1;
      if (!isNeutralFringePixel(data, neighbor, options)) continue;

      queue.push({ pixelIndex: neighbor, distance: distance + 1 });
    }
  }

  return removed;
}

function drawPolygonPath(
  context: CanvasRenderingContext2D,
  points: Point[],
) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
}

function applyConstrainedSegmentationToCanvas(
  manualCanvas: HTMLCanvasElement,
  segmentedCanvas: HTMLCanvasElement,
  refineBandPx: number,
) {
  const width = manualCanvas.width;
  const height = manualCanvas.height;
  const manualContext = manualCanvas.getContext("2d");
  const segmentedContext = segmentedCanvas.getContext("2d");

  if (!manualContext || !segmentedContext) {
    throw new Error("Canvas cutout is not available in this browser.");
  }

  const manualImageData = manualContext.getImageData(0, 0, width, height);
  const segmentedImageData = segmentedContext.getImageData(0, 0, width, height);
  applyConstrainedSegmentationAlpha(
    manualImageData.data,
    segmentedImageData.data,
    width,
    height,
    { refineBandPx },
  );
  manualContext.putImageData(manualImageData, 0, 0);
}

function applyPointSegmentationMaskToCanvas(
  canvas: HTMLCanvasElement,
  bounds: ManualCutoutBounds,
  sourceSize: SourceImageSize,
  mask: SegmentationMask,
  threshold: number,
  edgeFringePx: number,
) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas cutout is not available in this browser.");
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  applyPointSegmentationMaskToManualCutout(
    imageData.data,
    canvas.width,
    canvas.height,
    bounds,
    sourceSize,
    mask,
    threshold,
  );
  removeNeutralEdgeFringePixels(imageData.data, canvas.width, canvas.height, {
    maxDistancePx: edgeFringePx,
  });
  context.putImageData(imageData, 0, 0);
}

async function segmentSourcePhotoFromPoint(
  sourcePhoto: UploadedPhoto,
  targetPoint: Point,
): Promise<SegmentationMask> {
  const [image, segmenter] = await Promise.all([
    loadImage(sourcePhoto.dataUrl),
    getInteractiveSegmenter(),
  ]);
  const result = segmenter.segment(image, {
    keypoint: {
      x: clamp(targetPoint.x / sourcePhoto.width, 0, 1),
      y: clamp(targetPoint.y / sourcePhoto.height, 0, 1),
    },
  });
  const masks =
    result.confidenceMasks?.map((mask) => ({
      data: copyMaskData(mask),
      width: mask.width,
      height: mask.height,
    })) ?? [];
  const mask = selectPointSegmentationMask(masks, targetPoint, sourcePhoto);

  if (!mask) {
    result.close();
    throw new Error("Interactive segmentation did not return a confidence mask.");
  }

  result.close();

  return mask;
}

function copyMaskData(mask: MPMask) {
  if (mask.hasFloat32Array()) {
    return new Float32Array(mask.getAsFloat32Array());
  }

  return new Uint8Array(mask.getAsUint8Array());
}

function getMaskValueAtSourcePoint(
  mask: SegmentationMask,
  point: Point,
  sourceSize: SourceImageSize,
) {
  const maskX = clamp(
    Math.floor((point.x / sourceSize.width) * mask.width),
    0,
    mask.width - 1,
  );
  const maskY = clamp(
    Math.floor((point.y / sourceSize.height) * mask.height),
    0,
    mask.height - 1,
  );

  return mask.data[maskY * mask.width + maskX] ?? 0;
}

function isPointInPolygon(point: Point, polygon: Point[]) {
  let isInside = false;

  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    const xAtY =
      ((previous.x - current.x) * (point.y - current.y)) /
        (previous.y - current.y) +
      current.x;

    if (crossesY && point.x < xAtY) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function isNeutralFringePixel(
  data: Uint8ClampedArray,
  pixelIndex: number,
  options: {
    minAlpha?: number;
    minBrightness?: number;
    maxSaturation?: number;
  },
) {
  const dataIndex = pixelIndex * 4;
  if (data[dataIndex + 3] < (options.minAlpha ?? 16)) return false;

  const r = data[dataIndex];
  const g = data[dataIndex + 1];
  const b = data[dataIndex + 2];
  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);

  return (
    brightness >= (options.minBrightness ?? 168) &&
    saturation <= (options.maxSaturation ?? 38)
  );
}

function touchesTransparentOrCanvasEdge(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  minAlpha: number,
) {
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
    return true;
  }

  return getNeighborIndexes(x, y, width, height).some(
    (neighbor) => data[neighbor * 4 + 3] < minAlpha,
  );
}

async function getInteractiveSegmenter() {
  if (!interactiveSegmenterPromise) {
    interactiveSegmenterPromise = createInteractiveSegmenter();
  }

  return interactiveSegmenterPromise;
}

async function createInteractiveSegmenter() {
  const { FilesetResolver, InteractiveSegmenter } = await import(
    "@mediapipe/tasks-vision"
  );
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm",
  );

  return InteractiveSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-tasks/interactive_segmenter/ptm_512_hdt_ptm_woid.tflite",
    },
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
}

async function imageDataUrlToCanvas(dataUrl: string) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas cutout is not available in this browser.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function getAlphaDistanceFromExterior(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const distances = new Int16Array(width * height);
  distances.fill(32767);
  const queue: number[] = [];

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    if (data[pixelIndex * 4 + 3] >= 16) continue;

    distances[pixelIndex] = 0;
    queue.push(pixelIndex);
  }

  while (queue.length > 0) {
    const pixelIndex = queue.shift()!;
    const nextDistance = distances[pixelIndex] + 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    for (const neighbor of getNeighborIndexes(x, y, width, height)) {
      if (nextDistance >= distances[neighbor]) continue;

      distances[neighbor] = nextDistance;
      queue.push(neighbor);
    }
  }

  return distances;
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not encode manual cutout for segmentation."));
      }
    }, "image/png");
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image for cutout."));
    image.src = src;
  });
}

function stripImageExtension(name: string) {
  return name.replace(/\.(jpe?g|png|webp)$/i, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function getNeighborIndexes(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const neighbors: number[] = [];

  if (x > 0) neighbors.push(y * width + x - 1);
  if (x < width - 1) neighbors.push(y * width + x + 1);
  if (y > 0) neighbors.push((y - 1) * width + x);
  if (y < height - 1) neighbors.push((y + 1) * width + x);

  return neighbors;
}
