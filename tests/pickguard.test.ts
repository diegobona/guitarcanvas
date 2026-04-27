import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { generateDesigns } from "../lib/pickguard/patternGenerator";
import { pickguardTemplates } from "../lib/pickguard/templates";
import { buildCutoutPhoto } from "../lib/pickguard/backgroundRemoval";
import {
  buildColorRefinedManualCutoutPhoto,
  buildManualCutoutPhoto,
  getDominantExteriorRingColor,
  getManualCutoutBounds,
  getManualCutoutMaskPoints,
  getInsetPolygonPoints,
  removeConnectedSimilarColorPixels,
} from "../lib/pickguard/manualCutout";
import { buildStringOverlaySvg, buildSvgPackage } from "../lib/pickguard/exporters";
import {
  clampStringGuidePoint,
  getInitialStringOverlay,
} from "../lib/pickguard/geometry";

describe("pickguard template data", () => {
  it("ships the three MVP templates with replaceable SVG metadata", () => {
    assert.deepEqual(
      pickguardTemplates.map((template) => template.id),
      ["strat", "tele", "jazzmaster", "jaguar", "sg", "mustang"],
    );

    for (const template of pickguardTemplates) {
      assert.ok(template.name.length > 0);
      assert.ok(template.widthMm > 0);
      assert.ok(template.heightMm > 0);
      assert.match(template.viewBox, /^\d+ \d+ \d+ \d+$/);
      assert.match(template.outerPath, /^M/);
      assert.ok(template.holes.length > 0);
      assert.ok(Array.isArray(template.cutouts));
    }
  });
});

describe("local pattern generator", () => {
  it("returns four local data-url designs that keep the source prompt", () => {
    const prompt = "vintage paisley abalone tortoise sacred geometry";
    const designs = generateDesigns(prompt);

    assert.equal(designs.length, 4);
    assert.deepEqual(
      designs.map((design) => design.kind),
      ["paisley", "abalone", "tortoise", "geometry"],
    );

    for (const design of designs) {
      assert.equal(design.prompt, prompt);
      assert.match(design.imageDataUrl, /^data:image\/svg\+xml;base64,/);
      assert.ok(design.label.length > 0);
    }
  });
});

describe("SVG package builder", () => {
  it("embeds the template path, clip path, design image, and screw holes", () => {
    const template = pickguardTemplates[0];
    const design = generateDesigns("red paisley")[0];
    const svg = buildSvgPackage({ template, design });

    assert.match(svg, /<clipPath id="pickguard-clip">/);
    assert.match(svg, new RegExp(template.outerPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(svg, new RegExp(design.imageDataUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal((svg.match(/<circle/g) ?? []).length, template.holes.length);
  });
});

describe("string overlay builder", () => {
  it("starts string handles near the guitar center instead of photo edges", () => {
    const overlay = getInitialStringOverlay({ width: 800, height: 1200 });

    assert.equal(overlay.start.y, 408);
    assert.equal(overlay.end.y, 528);
    assert.ok(overlay.start.y > 300);
    assert.ok(overlay.end.y < 600);
  });

  it("keeps dragged string guide handles out of the bottom edge area", () => {
    const clamped = clampStringGuidePoint(
      { width: 800, height: 1200 },
      { x: 400, y: 1180 },
    );

    assert.equal(clamped.y, 624);
  });

  it("draws extended strings above the pickguard layer for mockups", () => {
    const svg = buildStringOverlaySvg({
      enabled: true,
      count: 6,
      start: { x: 430, y: 350 },
      end: { x: 430, y: 520 },
      spread: 140,
      opacity: 0.78,
      width: 3,
      extension: 460,
    });

    assert.equal((svg.match(/class="string-line"/g) ?? []).length, 6);
    assert.match(svg, /stroke="#f3ead8"/);
    assert.match(svg, /data-layer="strings-above-pickguard"/);
    assert.match(svg, /y1="-110"/);
    assert.match(svg, /y2="980"/);
  });
});

describe("AI background removal helpers", () => {
  it("keeps the source dimensions while replacing the image with a transparent PNG", () => {
    const source = {
      dataUrl: "data:image/jpeg;base64,old",
      name: "red-pickguard.jpg",
      width: 1400,
      height: 900,
    };

    const cutout = buildCutoutPhoto(
      source,
      "data:image/png;base64,transparent",
    );

    assert.deepEqual(cutout, {
      dataUrl: "data:image/png;base64,transparent",
      name: "red-pickguard-cutout.png",
      width: 1400,
      height: 900,
    });
  });
});

describe("manual pickguard cutout helpers", () => {
  it("crops the transparent output to the selected polygon bounds", () => {
    const source = {
      dataUrl: "data:image/png;base64,guitar",
      name: "full-guitar.png",
      width: 1000,
      height: 800,
    };
    const bounds = getManualCutoutBounds(
      source,
      [
        { x: 260, y: 180 },
        { x: 620, y: 210 },
        { x: 650, y: 520 },
        { x: 220, y: 500 },
      ],
      12,
    );

    assert.deepEqual(bounds, { x: 208, y: 168, width: 454, height: 364 });

    assert.deepEqual(
      buildManualCutoutPhoto(
        source,
        "data:image/png;base64,manual",
        bounds,
      ),
      {
        dataUrl: "data:image/png;base64,manual",
        name: "full-guitar-manual-cutout.png",
        width: 454,
        height: 364,
      },
    );
  });

  it("does not create manual bounds until at least three points are selected", () => {
    const bounds = getManualCutoutBounds(
      { width: 1000, height: 800 },
      [
        { x: 260, y: 180 },
        { x: 620, y: 210 },
      ],
    );

    assert.equal(bounds, null);
  });

  it("labels color-refined manual cutouts while preserving the cropped dimensions", () => {
    const source = {
      dataUrl: "data:image/png;base64,guitar",
      name: "full-guitar.png",
    };

    assert.deepEqual(
      buildColorRefinedManualCutoutPhoto(
        source,
        "data:image/png;base64,refined",
        { x: 208, y: 168, width: 454, height: 364 },
      ),
      {
        dataUrl: "data:image/png;base64,refined",
        name: "full-guitar-color-refined-cutout.png",
        width: 454,
        height: 364,
      },
    );
  });

  it("can trim a rough outline inward without changing the original point order", () => {
    const inset = getInsetPolygonPoints(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      10,
    );

    assert.deepEqual(inset, [
      { x: 7.07, y: 7.07 },
      { x: 92.93, y: 7.07 },
      { x: 92.93, y: 92.93 },
      { x: 7.07, y: 92.93 },
    ]);
  });

  it("translates the selected outline into cropped mask coordinates for color refinement", () => {
    const points = [
      { x: 260, y: 180 },
      { x: 620, y: 210 },
      { x: 650, y: 520 },
      { x: 220, y: 500 },
    ];
    const bounds = getManualCutoutBounds(
      { width: 1000, height: 800 },
      points,
      2,
    );

    assert.deepEqual(
      getManualCutoutMaskPoints(points, bounds!),
      [
        { x: 42, y: 2 },
        { x: 402, y: 32 },
        { x: 432, y: 342 },
        { x: 2, y: 322 },
      ],
    );
  });

  it("samples the guitar body color from just outside the selected outline", () => {
    const width = 6;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    fillPixels(data, { r: 245, g: 245, b: 245, a: 255 });
    setPixel(data, width, 1, 1, { r: 94, g: 196, b: 189, a: 255 });
    setPixel(data, width, 1, 2, { r: 93, g: 194, b: 188, a: 255 });
    setPixel(data, width, 1, 3, { r: 96, g: 197, b: 190, a: 255 });

    assert.deepEqual(
      getDominantExteriorRingColor(
        data,
        width,
        height,
        [
          { x: 2, y: 1 },
          { x: 4, y: 1 },
          { x: 4, y: 3 },
          { x: 2, y: 3 },
        ],
        1.25,
      ),
      { r: 94, g: 195, b: 189 },
    );
  });

  it("removes only edge-connected body color while keeping dark pickguard artwork", () => {
    const width = 5;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    fillPixels(data, { r: 42, g: 34, b: 32, a: 255 });

    for (let y = 0; y < height; y += 1) {
      setPixel(data, width, 0, y, { r: 93, g: 194, b: 188, a: 255 });
      setPixel(data, width, 1, y, { r: 97, g: 197, b: 191, a: 255 });
    }
    setPixel(data, width, 3, 2, { r: 91, g: 190, b: 185, a: 255 });

    const removed = removeConnectedSimilarColorPixels(
      data,
      width,
      height,
      { r: 94, g: 196, b: 189 },
    );

    assert.equal(removed, 8);
    assert.equal(getPixelAlpha(data, width, 0, 2), 0);
    assert.equal(getPixelAlpha(data, width, 1, 2), 0);
    assert.equal(getPixelAlpha(data, width, 2, 2), 255);
    assert.equal(getPixelAlpha(data, width, 3, 2), 255);
    assert.equal(getPixelAlpha(data, width, 4, 2), 255);
  });
});

describe("upload panel hydration guard", () => {
  it("suppresses upload drop attribute mismatches from cursor extensions", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.match(source, /<label\s+className="upload-drop"\s+suppressHydrationWarning/);
  });

  it("uses deterministic clean outline for manual cutouts instead of eager refinement imports", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.doesNotMatch(
      source,
      /import \{[^}]*createColorRefinedManualCutout[^}]*\} from/,
    );
    assert.match(source, /createManualCutout\(sourcePhoto, manualPoints, \{[\s\S]*insetPx: manualInset/);
    assert.match(source, /Clean body color/);
  });

  it("passes edge trim into color manual refinement", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.match(source, /createColorRefinedManualCutout\([\s\S]*sourcePhoto,[\s\S]*manualPoints,[\s\S]*\{[\s\S]*insetPx: manualInset/);
  });
});

type TestPixel = {
  r: number;
  g: number;
  b: number;
  a: number;
};

function fillPixels(data: Uint8ClampedArray, pixel: TestPixel) {
  for (let index = 0; index < data.length; index += 4) {
    data[index] = pixel.r;
    data[index + 1] = pixel.g;
    data[index + 2] = pixel.b;
    data[index + 3] = pixel.a;
  }
}

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  pixel: TestPixel,
) {
  const index = (y * width + x) * 4;
  data[index] = pixel.r;
  data[index + 1] = pixel.g;
  data[index + 2] = pixel.b;
  data[index + 3] = pixel.a;
}

function getPixelAlpha(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
) {
  return data[(y * width + x) * 4 + 3];
}
