import type { GeneratedDesign } from "./patternGenerator";
import { parseViewBox, type PickguardTemplate } from "./templates";
import {
  getPickguardBaseSize,
  type PickguardTransform,
  type StringOverlay,
  type UploadedPhoto,
} from "./geometry";

type SvgPackageInput = {
  template: PickguardTemplate;
  design: GeneratedDesign;
};

type MockupExportInput = SvgPackageInput & {
  photo: UploadedPhoto;
  transform: PickguardTransform;
  stringOverlay?: StringOverlay;
};

export function buildSvgPackage({ template, design }: SvgPackageInput) {
  const viewBox = parseViewBox(template.viewBox);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${template.widthMm}mm" height="${template.heightMm}mm" viewBox="${template.viewBox}">
  <title>${escapeXml(template.name)} pickguard design</title>
  <defs>
    <clipPath id="pickguard-clip">
      <path d="${escapeXml(template.outerPath)}"/>
    </clipPath>
  </defs>
  <image href="${escapeXml(design.imageDataUrl)}" x="${viewBox.minX}" y="${viewBox.minY}" width="${viewBox.width}" height="${viewBox.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pickguard-clip)"/>
  <path d="${escapeXml(template.outerPath)}" fill="none" stroke="#111111" stroke-width="8"/>
  ${template.holes
    .map(
      (hole) =>
        `<circle cx="${hole.x}" cy="${hole.y}" r="${hole.r}" fill="none" stroke="#111111" stroke-width="6"/>`,
    )
    .join("\n  ")}
</svg>`;
}

export async function exportSvgPackage(input: SvgPackageInput) {
  const svg = buildSvgPackage(input);
  downloadBlob(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    "pickguard-design.svg",
  );
}

export async function exportTransparentPng(input: SvgPackageInput) {
  const viewBox = parseViewBox(input.template.viewBox);
  const svg = buildSvgPackage(input);
  const canvas = await renderSvgToCanvas(svg, viewBox.width, viewBox.height);
  downloadDataUrl(
    canvas.toDataURL("image/png"),
    "pickguard-design-transparent.png",
  );
}

export async function exportMockupJpg({
  template,
  design,
  photo,
  transform,
  stringOverlay,
}: MockupExportInput) {
  const svg = buildMockupSvg({ template, design, photo, transform, stringOverlay });
  const canvas = await renderSvgToCanvas(svg, photo.width, photo.height, "#111318");
  downloadDataUrl(
    canvas.toDataURL("image/jpeg", 0.92),
    "guitar-pickguard-mockup.jpg",
  );
}

export async function exportPrintablePdf(input: SvgPackageInput) {
  const { jsPDF } = await import("jspdf");
  const pageHeight = input.template.heightMm + 24;
  const orientation =
    input.template.widthMm >= pageHeight ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: [input.template.widthMm, pageHeight],
  });
  const viewBox = parseViewBox(input.template.viewBox);
  const svg = buildSvgPackage(input);
  const canvas = await renderSvgToCanvas(svg, viewBox.width * 2, viewBox.height * 2);
  const png = canvas.toDataURL("image/png");

  pdf.addImage(
    png,
    "PNG",
    0,
    0,
    input.template.widthMm,
    input.template.heightMm,
  );
  pdf.setFontSize(8);
  pdf.text(
    "Print reference only. Not a CNC-ready replacement template.",
    8,
    input.template.heightMm + 12,
    { maxWidth: input.template.widthMm - 16 },
  );
  pdf.save("pickguard-print-reference.pdf");
}

function buildMockupSvg({
  template,
  design,
  photo,
  transform,
  stringOverlay,
}: MockupExportInput) {
  const base = getPickguardBaseSize(template, photo);
  const pickguardSvg = buildEmbeddedPickguardSvg({ template, design });
  const stringsSvg = stringOverlay ? buildStringOverlaySvg(stringOverlay) : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${photo.width}" height="${photo.height}" viewBox="0 0 ${photo.width} ${photo.height}">
  <rect width="100%" height="100%" fill="#111318"/>
  <image href="${escapeXml(photo.dataUrl)}" x="0" y="0" width="${photo.width}" height="${photo.height}" preserveAspectRatio="xMidYMid meet"/>
  <g transform="translate(${transform.x} ${transform.y}) rotate(${transform.rotation}) scale(${transform.scale}) translate(${-base.width / 2} ${-base.height / 2})">
    <svg width="${base.width}" height="${base.height}" viewBox="${template.viewBox}">
      ${pickguardSvg}
    </svg>
  </g>
  ${stringsSvg}
</svg>`;
}

export function buildEmbeddedPickguardSvg({ template, design }: SvgPackageInput) {
  const viewBox = parseViewBox(template.viewBox);

  return `
    <defs>
      <clipPath id="pickguard-clip">
        <path d="${escapeXml(template.outerPath)}"/>
      </clipPath>
    </defs>
    <image href="${escapeXml(design.imageDataUrl)}" x="${viewBox.minX}" y="${viewBox.minY}" width="${viewBox.width}" height="${viewBox.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pickguard-clip)"/>
    <path d="${escapeXml(template.outerPath)}" fill="none" stroke="rgba(255,255,255,0.86)" stroke-width="8"/>
    ${template.holes
      .map(
        (hole) =>
          `<circle cx="${hole.x}" cy="${hole.y}" r="${hole.r}" fill="rgba(255,255,255,0.62)" stroke="#161616" stroke-width="5"/>`,
      )
      .join("\n    ")}
  `;
}

export function buildStringOverlaySvg(overlay: StringOverlay) {
  if (!overlay.enabled || overlay.count < 1) return "";

  const lines = getStringLines(overlay);
  const shadowWidth = overlay.width + 1.2;

  return `<g data-layer="strings-above-pickguard" opacity="${overlay.opacity}">
    ${lines
      .map(
        (line) =>
          `<line class="string-shadow" x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#14110d" stroke-width="${shadowWidth}" stroke-linecap="round" opacity="0.54"/>`,
      )
      .join("\n    ")}
    ${lines
      .map(
        (line) =>
          `<line class="string-line" x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#f3ead8" stroke-width="${overlay.width}" stroke-linecap="round"/>`,
      )
      .join("\n    ")}
  </g>`;
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
      x1: round(overlay.start.x + normalX * offset - unitX * extension),
      y1: round(overlay.start.y + normalY * offset - unitY * extension),
      x2: round(overlay.end.x + normalX * offset + unitX * extension),
      y2: round(overlay.end.y + normalY * offset + unitY * extension),
    };
  });
}

async function renderSvgToCanvas(
  svg: string,
  width: number,
  height: number,
  background?: string,
) {
  const image = await loadImage(svgToDataUrl(svg));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas export is not available in this browser.");
  }

  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image for export."));
    image.src = src;
  });
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
