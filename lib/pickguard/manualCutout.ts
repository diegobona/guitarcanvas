import type { Point, UploadedPhoto } from "./geometry";
import type { BackgroundRemovalProgress } from "./backgroundRemoval";

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

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type ManualCutoutOptions = {
  insetPx?: number;
};

type ColorManualCutoutOptions = ManualCutoutOptions & {
  onProgress?: (progress: BackgroundRemovalProgress) => void;
};

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

export async function createColorRefinedManualCutout(
  sourcePhoto: UploadedPhoto,
  points: Point[],
  optionsOrProgress?:
    | ColorManualCutoutOptions
    | ((progress: BackgroundRemovalProgress) => void),
): Promise<UploadedPhoto> {
  const options =
    typeof optionsOrProgress === "function"
      ? { onProgress: optionsOrProgress }
      : (optionsOrProgress ?? {});
  const maskPoints = getInsetPolygonPoints(points, options.insetPx ?? 0);
  const candidate = await createManualCutoutCandidate(sourcePhoto, points, {
    insetPx: options.insetPx,
  });

  await removeExteriorBodyColor(
    sourcePhoto,
    maskPoints,
    candidate.canvas,
  );
  options.onProgress?.({ key: "color-refine", current: 1, total: 1 });

  return buildColorRefinedManualCutoutPhoto(
    sourcePhoto,
    candidate.canvas.toDataURL("image/png"),
    candidate.bounds,
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

export function buildColorRefinedManualCutoutPhoto(
  sourcePhoto: Pick<UploadedPhoto, "dataUrl" | "name">,
  transparentDataUrl: string,
  bounds: ManualCutoutBounds,
): UploadedPhoto {
  return {
    dataUrl: transparentDataUrl,
    name: `${stripImageExtension(sourcePhoto.name)}-color-refined-cutout.png`,
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
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

async function removeExteriorBodyColor(
  sourcePhoto: UploadedPhoto,
  maskPoints: Point[],
  cutoutCanvas: HTMLCanvasElement,
) {
  const image = await loadImage(sourcePhoto.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourcePhoto.width);
  canvas.height = Math.round(sourcePhoto.height);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas cutout is not available in this browser.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const sourceImageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const bodyColor = getDominantExteriorRingColor(
    sourceImageData.data,
    canvas.width,
    canvas.height,
    maskPoints,
  );

  if (!bodyColor) return;

  const cutoutContext = cutoutCanvas.getContext("2d");
  if (!cutoutContext) {
    throw new Error("Canvas cutout is not available in this browser.");
  }

  const cutoutImageData = cutoutContext.getImageData(
    0,
    0,
    cutoutCanvas.width,
    cutoutCanvas.height,
  );
  removeConnectedSimilarColorPixels(
    cutoutImageData.data,
    cutoutCanvas.width,
    cutoutCanvas.height,
    bodyColor,
  );
  cutoutContext.putImageData(cutoutImageData, 0, 0);
}

export function getDominantExteriorRingColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  polygon: Point[],
  ringPx = 10,
): RgbColor | null {
  const buckets = new Map<
    string,
    { count: number; r: number; g: number; b: number; saturation: number }
  >();
  const bounds = getPolygonBounds(polygon, width, height, ringPx);

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const point = { x: x + 0.5, y: y + 0.5 };
      if (isPointInPolygon(point, polygon)) continue;
      if (getDistanceToPolygon(point, polygon) > ringPx) continue;

      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 180) continue;

      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const key = getColorBucketKey(r, g, b);
      const bucket =
        buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0, saturation: 0 };
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.saturation += getColorSaturation({ r, g, b });
      buckets.set(key, bucket);
    }
  }

  const bucketValues = [...buckets.values()];
  const saturatedBuckets = bucketValues.filter(
    (bucket) => bucket.saturation / bucket.count >= 25,
  );
  const best = (saturatedBuckets.length > 0 ? saturatedBuckets : bucketValues)
    .sort((a, b) => b.count - a.count)[0];
  if (!best) return null;

  return {
    r: Math.round(best.r / best.count),
    g: Math.round(best.g / best.count),
    b: Math.round(best.b / best.count),
  };
}

export function removeConnectedSimilarColorPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  targetColor: RgbColor,
  threshold = 64,
) {
  const queue: number[] = [];
  const visited = new Uint8Array(width * height);
  let removed = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      if (!touchesTransparentOrCanvasEdge(data, width, height, x, y)) continue;
      if (!isSimilarOpaquePixel(data, pixelIndex, targetColor, threshold)) continue;

      visited[pixelIndex] = 1;
      queue.push(pixelIndex);
    }
  }

  while (queue.length > 0) {
    const pixelIndex = queue.shift()!;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    data[pixelIndex * 4 + 3] = 0;
    removed += 1;

    for (const neighbor of getNeighborIndexes(x, y, width, height)) {
      if (visited[neighbor]) continue;
      visited[neighbor] = 1;
      if (isSimilarOpaquePixel(data, neighbor, targetColor, threshold)) {
        queue.push(neighbor);
      }
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

function getPolygonBounds(
  polygon: Point[],
  width: number,
  height: number,
  padding: number,
) {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);

  return {
    minX: Math.floor(clamp(Math.min(...xs) - padding, 0, width - 1)),
    minY: Math.floor(clamp(Math.min(...ys) - padding, 0, height - 1)),
    maxX: Math.ceil(clamp(Math.max(...xs) + padding, 0, width - 1)),
    maxY: Math.ceil(clamp(Math.max(...ys) + padding, 0, height - 1)),
  };
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

function getDistanceToPolygon(point: Point, polygon: Point[]) {
  return polygon.reduce((closest, current, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return Math.min(closest, getDistanceToSegment(point, current, next));
  }, Number.POSITIVE_INFINITY);
}

function getDistanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1,
  );

  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function getColorBucketKey(r: number, g: number, b: number) {
  return `${Math.floor(r / 16)}-${Math.floor(g / 16)}-${Math.floor(b / 16)}`;
}

function touchesTransparentOrCanvasEdge(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
    return true;
  }

  return getNeighborIndexes(x, y, width, height).some(
    (neighbor) => data[neighbor * 4 + 3] < 16,
  );
}

function isSimilarOpaquePixel(
  data: Uint8ClampedArray,
  pixelIndex: number,
  targetColor: RgbColor,
  threshold: number,
) {
  const dataIndex = pixelIndex * 4;
  if (data[dataIndex + 3] < 180) return false;

  return (
    getColorDistance(
      { r: data[dataIndex], g: data[dataIndex + 1], b: data[dataIndex + 2] },
      targetColor,
    ) <= threshold
  );
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

function getColorDistance(left: RgbColor, right: RgbColor) {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}

function getColorSaturation(color: RgbColor) {
  return Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
}
