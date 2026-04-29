import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { generateDesigns } from "../lib/pickguard/patternGenerator";
import { pickguardTemplates } from "../lib/pickguard/templates";
import { buildCutoutPhoto } from "../lib/pickguard/backgroundRemoval";
import {
  applyConstrainedSegmentationAlpha,
  applyDarkTargetConnectedMaskToManualCutout,
  applyEraseStrokesToManualCutout,
  applyPointSegmentationMaskToManualCutout,
  applyPointSegmentationPreviewPixels,
  buildConstrainedSegmentedManualCutoutPhoto,
  buildPointSegmentedManualCutoutPhoto,
  buildPointSegmentationPreviewPhoto,
  buildManualCutoutPhoto,
  getManualCutoutBounds,
  getManualCutoutMaskPoints,
  getInsetPolygonPoints,
  getDominantExteriorRingColors,
  filterExteriorColorsDistinctFromTarget,
  splitExteriorCleanupColorsByInterior,
  removeEdgeFringePixelsMatchingColors,
  removeNeutralEdgeFringePixels,
  selectPointSegmentationMask,
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

  it("labels constrained segmented manual cutouts while preserving the cropped dimensions", () => {
    const source = {
      dataUrl: "data:image/png;base64,guitar",
      name: "full-guitar.png",
    };

    assert.deepEqual(
      buildConstrainedSegmentedManualCutoutPhoto(
        source,
        "data:image/png;base64,refined",
        { x: 208, y: 168, width: 454, height: 364 },
      ),
      {
        dataUrl: "data:image/png;base64,refined",
        name: "full-guitar-constrained-segmented-cutout.png",
        width: 454,
        height: 364,
      },
    );
  });

  it("labels point segmented manual cutouts while preserving the cropped dimensions", () => {
    const source = {
      dataUrl: "data:image/png;base64,guitar",
      name: "full-guitar.png",
    };

    assert.deepEqual(
      buildPointSegmentedManualCutoutPhoto(
        source,
        "data:image/png;base64,point",
        { x: 208, y: 168, width: 454, height: 364 },
      ),
      {
        dataUrl: "data:image/png;base64,point",
        name: "full-guitar-point-segmented-cutout.png",
        width: 454,
        height: 364,
      },
    );
  });

  it("labels point segmentation previews while preserving the source dimensions", () => {
    const source = {
      dataUrl: "data:image/png;base64,guitar",
      name: "full-guitar.png",
      width: 1000,
      height: 800,
    };

    assert.deepEqual(
      buildPointSegmentationPreviewPhoto(
        source,
        "data:image/png;base64,preview",
      ),
      {
        dataUrl: "data:image/png;base64,preview",
        name: "full-guitar-point-segmentation-preview.png",
        width: 1000,
        height: 800,
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

  it("translates the selected outline into cropped mask coordinates for segmentation refinement", () => {
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

  it("uses segmentation in the configurable edge band while preserving protected interior artwork", () => {
    const width = 9;
    const height = 9;
    const manualData = new Uint8ClampedArray(width * height * 4);
    const segmentData = new Uint8ClampedArray(width * height * 4);
    fillPixels(manualData, { r: 0, g: 0, b: 0, a: 0 });
    fillPixels(segmentData, { r: 0, g: 0, b: 0, a: 0 });

    for (let y = 1; y <= 7; y += 1) {
      for (let x = 1; x <= 7; x += 1) {
        setPixel(manualData, width, x, y, { r: 190, g: 150, b: 120, a: 255 });
        setPixel(segmentData, width, x, y, { r: 190, g: 150, b: 120, a: 255 });
      }
    }

    setPixel(segmentData, width, 1, 4, { r: 190, g: 150, b: 120, a: 0 });
    setPixel(segmentData, width, 3, 4, { r: 190, g: 150, b: 120, a: 0 });
    setPixel(segmentData, width, 4, 4, { r: 190, g: 150, b: 120, a: 0 });

    applyConstrainedSegmentationAlpha(
      manualData,
      segmentData,
      width,
      height,
      { refineBandPx: 3 },
    );

    assert.equal(getPixelAlpha(manualData, width, 1, 4), 0);
    assert.equal(getPixelAlpha(manualData, width, 3, 4), 0);
    assert.equal(getPixelAlpha(manualData, width, 4, 4), 255);
    assert.equal(getPixelAlpha(manualData, width, 7, 4), 255);
  });

  it("applies a full-image point mask inside the cropped manual outline", () => {
    const width = 4;
    const height = 4;
    const manualData = new Uint8ClampedArray(width * height * 4);
    const maskData = new Float32Array(10 * 10);
    fillPixels(manualData, { r: 190, g: 150, b: 120, a: 255 });

    for (let y = 3; y <= 5; y += 1) {
      for (let x = 3; x <= 5; x += 1) {
        maskData[y * 10 + x] = 0.9;
      }
    }

    applyPointSegmentationMaskToManualCutout(
      manualData,
      width,
      height,
      { x: 2, y: 2, width, height },
      { width: 10, height: 10 },
      { data: maskData, width: 10, height: 10 },
      0.5,
    );

    assert.equal(getPixelAlpha(manualData, width, 0, 0), 0);
    assert.equal(getPixelAlpha(manualData, width, 1, 1), 255);
    assert.equal(getPixelAlpha(manualData, width, 0, 3), 0);
  });

  it("applies erase outside strokes to final manual cutout pixels", () => {
    const width = 7;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    fillPixels(data, { r: 120, g: 80, b: 50, a: 255 });

    const removed = applyEraseStrokesToManualCutout(
      data,
      width,
      height,
      { x: 10, y: 20, width, height },
      [{ points: [{ x: 13, y: 22 }], radiusPx: 1.5 }],
    );

    assert.equal(removed, 9);
    assert.equal(getPixelAlpha(data, width, 3, 2), 0);
    assert.equal(getPixelAlpha(data, width, 0, 0), 255);
  });

  it("uses the confidence mask that contains the clicked target point", () => {
    const backgroundMask = new Float32Array(4 * 4).fill(0.85);
    const pickguardMask = new Float32Array(4 * 4).fill(0.05);
    backgroundMask[2 * 4 + 2] = 0.1;
    pickguardMask[2 * 4 + 2] = 0.95;

    const selected = selectPointSegmentationMask(
      [
        { data: backgroundMask, width: 4, height: 4 },
        { data: pickguardMask, width: 4, height: 4 },
      ],
      { x: 50, y: 50 },
      { width: 100, height: 100 },
    );

    assert.equal(selected?.data, pickguardMask);
  });

  it("paints a translucent preview only where the selected mask is confident", () => {
    const width = 4;
    const height = 4;
    const previewData = new Uint8ClampedArray(width * height * 4);
    const maskData = new Float32Array(4 * 4);
    maskData[1 * 4 + 1] = 0.9;
    maskData[1 * 4 + 2] = 0.9;

    applyPointSegmentationPreviewPixels(
      previewData,
      width,
      height,
      { width, height },
      { data: maskData, width, height },
      0.5,
    );

    assert.equal(getPixelAlpha(previewData, width, 0, 0), 0);
    assert.equal(getPixelAlpha(previewData, width, 1, 1), 94);
    assert.equal(previewData[(1 * width + 1) * 4], 56);
    assert.equal(previewData[(1 * width + 1) * 4 + 1], 189);
    assert.equal(previewData[(1 * width + 1) * 4 + 2], 248);
  });

  it("clips the point preview to the hand-drawn outline", () => {
    const width = 4;
    const height = 4;
    const previewData = new Uint8ClampedArray(width * height * 4);
    const maskData = new Float32Array(4 * 4).fill(0.9);

    applyPointSegmentationPreviewPixels(
      previewData,
      width,
      height,
      { width, height },
      { data: maskData, width, height },
      0.5,
      undefined,
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 3 },
        { x: 1, y: 3 },
      ],
    );

    assert.equal(getPixelAlpha(previewData, width, 0, 0), 0);
    assert.equal(getPixelAlpha(previewData, width, 1, 1), 94);
    assert.equal(getPixelAlpha(previewData, width, 2, 2), 94);
    assert.equal(getPixelAlpha(previewData, width, 3, 3), 0);
  });

  it("removes only neutral edge fringe while preserving warm pickguard and interior white parts", () => {
    const width = 7;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    fillPixels(data, { r: 0, g: 0, b: 0, a: 0 });

    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 5; x += 1) {
        setPixel(data, width, x, y, { r: 190, g: 150, b: 118, a: 255 });
      }
    }

    setPixel(data, width, 1, 2, { r: 235, g: 236, b: 234, a: 255 });
    setPixel(data, width, 2, 2, { r: 226, g: 228, b: 225, a: 255 });
    setPixel(data, width, 4, 2, { r: 244, g: 244, b: 238, a: 255 });

    const removed = removeNeutralEdgeFringePixels(data, width, height, {
      maxDistancePx: 3,
    });

    assert.equal(removed, 2);
    assert.equal(getPixelAlpha(data, width, 1, 2), 0);
    assert.equal(getPixelAlpha(data, width, 2, 2), 0);
    assert.equal(getPixelAlpha(data, width, 1, 1), 255);
    assert.equal(getPixelAlpha(data, width, 4, 2), 255);
  });

  it("samples saturated guitar body colors from just outside the selected outline", () => {
    const width = 6;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    fillPixels(data, { r: 23, g: 23, b: 22, a: 255 });
    setPixel(data, width, 1, 1, { r: 171, g: 9, b: 18, a: 255 });
    setPixel(data, width, 1, 2, { r: 178, g: 12, b: 22, a: 255 });
    setPixel(data, width, 1, 3, { r: 166, g: 8, b: 16, a: 255 });

    const colors = getDominantExteriorRingColors(
      data,
      width,
      height,
      [
        { x: 2, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 3 },
        { x: 2, y: 3 },
      ],
      { ringPx: 1.25 },
    );

    assert.deepEqual(colors[0], { r: 172, g: 10, b: 19 });
  });

  it("keeps neutral exterior shadow samples alongside saturated body colors", () => {
    const width = 7;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    fillPixels(data, { r: 24, g: 24, b: 23, a: 255 });
    setPixel(data, width, 1, 1, { r: 174, g: 12, b: 20, a: 255 });
    setPixel(data, width, 1, 2, { r: 178, g: 11, b: 22, a: 255 });
    setPixel(data, width, 1, 3, { r: 168, g: 8, b: 17, a: 255 });
    setPixel(data, width, 5, 1, { r: 34, g: 35, b: 33, a: 255 });
    setPixel(data, width, 5, 2, { r: 36, g: 36, b: 34, a: 255 });
    setPixel(data, width, 5, 3, { r: 33, g: 34, b: 32, a: 255 });

    const colors = getDominantExteriorRingColors(
      data,
      width,
      height,
      [
        { x: 2, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 3 },
        { x: 2, y: 3 },
      ],
      { ringPx: 1.25, maxColors: 4 },
    );

    assert.ok(colors.some((color) => color.r > 150 && color.g < 40));
    assert.ok(colors.some((color) => color.r < 60 && color.g < 60));
  });

  it("removes sampled red body fringe while preserving black guard and white ply line", () => {
    const width = 8;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    fillPixels(data, { r: 0, g: 0, b: 0, a: 0 });

    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 6; x += 1) {
        setPixel(data, width, x, y, { r: 24, g: 24, b: 23, a: 255 });
      }
    }

    setPixel(data, width, 1, 2, { r: 177, g: 11, b: 22, a: 255 });
    setPixel(data, width, 2, 2, { r: 164, g: 8, b: 18, a: 255 });
    setPixel(data, width, 3, 2, { r: 245, g: 246, b: 241, a: 255 });
    setPixel(data, width, 5, 2, { r: 178, g: 10, b: 19, a: 255 });

    const removed = removeEdgeFringePixelsMatchingColors(
      data,
      width,
      height,
      [{ r: 172, g: 10, b: 19 }],
      { threshold: 42, maxDistancePx: 4 },
    );

    assert.equal(removed, 2);
    assert.equal(getPixelAlpha(data, width, 1, 2), 0);
    assert.equal(getPixelAlpha(data, width, 2, 2), 0);
    assert.equal(getPixelAlpha(data, width, 3, 2), 255);
    assert.equal(getPixelAlpha(data, width, 4, 2), 255);
    assert.equal(getPixelAlpha(data, width, 5, 2), 255);
  });

  it("does not apply sampled color cleanup when it would erase the whole cutout", () => {
    const width = 5;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    fillPixels(data, { r: 92, g: 105, b: 101, a: 255 });

    const removed = removeEdgeFringePixelsMatchingColors(
      data,
      width,
      height,
      [{ r: 94, g: 106, b: 102 }],
      { threshold: 24, maxDistancePx: 10 },
    );

    assert.equal(removed, 0);
    assert.equal(getPixelAlpha(data, width, 0, 0), 255);
    assert.equal(getPixelAlpha(data, width, 2, 2), 255);
  });

  it("ignores sampled body colors that are too close to the clicked guard color", () => {
    assert.deepEqual(
      filterExteriorColorsDistinctFromTarget(
        [
          { r: 28, g: 29, b: 27 },
          { r: 170, g: 8, b: 18 },
        ],
        { r: 24, g: 24, b: 23 },
        72,
      ),
      [{ r: 170, g: 8, b: 18 }],
    );
  });

  it("keeps saturated exterior cleanup colors even near a saturated guard target", () => {
    assert.deepEqual(
      filterExteriorColorsDistinctFromTarget(
        [
          { r: 125, g: 36, b: 24 },
          { r: 35, g: 35, b: 34 },
        ],
        { r: 118, g: 30, b: 20 },
        72,
      ),
      [
        { r: 125, g: 36, b: 24 },
        { r: 35, g: 35, b: 34 },
      ],
    );
  });

  it("limits exterior colors that also appear inside a patterned guard to edge cleanup", () => {
    assert.deepEqual(
      splitExteriorCleanupColorsByInterior(
        [
          { r: 126, g: 36, b: 24 },
          { r: 34, g: 34, b: 33 },
          { r: 178, g: 12, b: 20 },
        ],
        [
          { r: 118, g: 31, b: 22 },
          { r: 27, g: 27, b: 26 },
        ],
        48,
      ),
      {
        globalColors: [{ r: 178, g: 12, b: 20 }],
        edgeOnlyColors: [
          { r: 126, g: 36, b: 24 },
          { r: 34, g: 34, b: 33 },
        ],
      },
    );
  });

  it("does not depend on a dark connected component after point segmentation", () => {
    const source = readFileSync(
      "lib/pickguard/manualCutout.ts",
      "utf8",
    );

    const canvasPipeline = source.match(
      /function applyPointSegmentationMaskToCanvas[\s\S]*?context\.putImageData\(imageData, 0, 0\);[\s\S]*?\}/,
    )?.[0] ?? "";

    assert.ok(canvasPipeline.length > 0);
    assert.doesNotMatch(canvasPipeline, /applyDarkTargetConnectedMaskToManualCutout/);
  });

  it("keeps separated dark guard islands when the point mask selects them", () => {
    const width = 9;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    const maskData = new Float32Array(width * height).fill(0.9);
    fillPixels(data, { r: 0, g: 0, b: 0, a: 0 });

    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 7; x += 1) {
        setPixel(data, width, x, y, { r: 24, g: 24, b: 23, a: 255 });
      }
    }

    setPixel(data, width, 4, 2, { r: 245, g: 246, b: 241, a: 255 });
    setPixel(data, width, 2, 2, { r: 0, g: 0, b: 0, a: 0 });
    setPixel(data, width, 6, 2, { r: 0, g: 0, b: 0, a: 0 });

    applyPointSegmentationMaskToManualCutout(
      data,
      width,
      height,
      { x: 0, y: 0, width, height },
      { width, height },
      { data: maskData, width, height },
      0.5,
    );

    assert.equal(getPixelAlpha(data, width, 1, 2), 255);
    assert.equal(getPixelAlpha(data, width, 3, 2), 255);
    assert.equal(getPixelAlpha(data, width, 5, 2), 255);
    assert.equal(getPixelAlpha(data, width, 7, 2), 255);
  });

  it("keeps the dark target guard component and drops surrounding red body", () => {
    const width = 11;
    const height = 9;
    const data = new Uint8ClampedArray(width * height * 4);
    fillPixels(data, { r: 0, g: 0, b: 0, a: 0 });

    for (let y = 1; y <= 7; y += 1) {
      for (let x = 1; x <= 9; x += 1) {
        setPixel(data, width, x, y, { r: 170, g: 8, b: 18, a: 255 });
      }
    }

    for (let y = 3; y <= 6; y += 1) {
      for (let x = 3; x <= 7; x += 1) {
        setPixel(data, width, x, y, { r: 24, g: 24, b: 23, a: 255 });
      }
    }

    for (let x = 3; x <= 7; x += 1) {
      setPixel(data, width, x, 2, { r: 239, g: 241, b: 236, a: 255 });
    }
    setPixel(data, width, 5, 5, { r: 242, g: 240, b: 224, a: 255 });

    const applied = applyDarkTargetConnectedMaskToManualCutout(
      data,
      width,
      height,
      { x: 5, y: 4 },
    );

    assert.equal(applied, true);
    assert.equal(getPixelAlpha(data, width, 1, 1), 0);
    assert.equal(getPixelAlpha(data, width, 5, 4), 255);
    assert.equal(getPixelAlpha(data, width, 5, 2), 255);
    assert.equal(getPixelAlpha(data, width, 5, 5), 255);
  });
});

describe("upload panel hydration guard", () => {
  it("offers separate upload modes for standalone pickguards and guitar photos", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.match(source, /Single pickguard image/);
    assert.match(source, /Guitar photo \(with pickguard\)/);
    assert.match(source, /pickguardSourceMode/);
  });

  it("styles pickguard source choices as options instead of action buttons", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );
    const css = readFileSync("app/globals.css", "utf8");
    const sourceModeMarkup = source.match(
      /<div className="source-mode-row">[\s\S]*?<\/div>/,
    )?.[0] ?? "";

    assert.match(sourceModeMarkup, /source-mode-option/);
    assert.match(sourceModeMarkup, /is-selected/);
    assert.doesNotMatch(sourceModeMarkup, /primary-button/);
    assert.doesNotMatch(sourceModeMarkup, /secondary-button/);
    assert.match(css, /\.source-mode-option/);
    assert.match(css, /\.source-mode-option\.is-selected/);
  });

  it("marks the standalone pickguard option as recommended and previews examples on hover", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );
    const css = readFileSync("app/globals.css", "utf8");
    const sourceModeMarkup = source.match(
      /<div className="source-mode-row">[\s\S]*?<\/div>/,
    )?.[0] ?? "";

    assert.match(sourceModeMarkup, /Recommended/);
    assert.match(sourceModeMarkup, /source-mode-preview/);
    assert.match(sourceModeMarkup, /source-mode-example/);
    assert.match(sourceModeMarkup, /source-mode-pickguard-example/);
    assert.match(sourceModeMarkup, /source-mode-guitar-example/);
    assert.doesNotMatch(sourceModeMarkup, /Only the pickguard/);
    assert.doesNotMatch(sourceModeMarkup, /Full guitar photo/);
    assert.doesNotMatch(sourceModeMarkup, /source-mode-hint/);
    assert.match(css, /\.source-mode-example/);
    assert.match(css, /\.source-mode-preview/);
    assert.match(css, /\.source-mode-option:hover \.source-mode-preview/);
    assert.match(css, /\.source-mode-option:focus-visible \.source-mode-preview/);
    assert.match(css, /\.source-mode-recommendation/);
    assert.doesNotMatch(css, /\.source-mode-hint/);
  });

  it("skips automatic background removal when the pickguard source is a guitar photo", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.match(source, /pickguardSourceMode === "guitar"/);
    assert.match(source, /setManualOpen\(true\)/);
    assert.match(
      source,
      /if \(pickguardSourceMode === "guitar"\) \{[\s\S]*setManualOpen\(true\);[\s\S]*return;[\s\S]*\}[\s\S]*setCutout\(\{ status: "removing", progress: 0 \}\);/,
    );
  });

  it("suppresses upload drop attribute mismatches from cursor extensions", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.match(source, /<label\s+className="upload-drop"\s+suppressHydrationWarning/);
  });

  it("uses point segmentation as the only manual cutout action", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.doesNotMatch(
      source,
      /import \{[^}]*createPointSegmentedManualCutout[^}]*\} from/,
    );
    assert.doesNotMatch(source, /createManualCutout/);
    assert.match(source, /Cut out pickguard/);
    assert.doesNotMatch(source, /Clean body color/);
  });

  it("passes the current target point into point segmentation without exposed trim state", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.match(source, /createPointSegmentedManualCutout\([\s\S]*sourcePhoto,[\s\S]*manualPoints,[\s\S]*manualTargetPoint,[\s\S]*\{[\s\S]*onProgress: handleCutoutProgress/);
    assert.doesNotMatch(source, /manualInset/);
  });

  it("lets a new target click replace the previous segmentation point", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.match(source, /manualTargetPoint/);
    assert.match(source, /setManualTargetPoint\(point\)/);
    assert.doesNotMatch(source, /setManualTargetPoint\(\(current/);
    assert.match(source, /Click inside the pickguard/);
    assert.match(source, /Cut out pickguard/);
  });

  it("closes the manual outline by clicking the first point before picking inside", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.match(
      source,
      /Draw around the pickguard edge\. When the outline surrounds it, click inside the pickguard\./,
    );
    assert.match(source, /Click the first point to close the outline/);
    assert.match(source, /isNearFirstPoint/);
    assert.doesNotMatch(source, /Draw outline/);
    assert.doesNotMatch(source, /Pick inside/);
    assert.doesNotMatch(source, /pick one point on the pickguard, then segment it/);
  });

  it("previews the point-selected region before applying the cutout", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.match(source, /manualSegmentPreview/);
    assert.match(source, /createPointSegmentationPreview/);
    assert.match(source, /clipPoints: manualPoints/);
    assert.match(source, /segmentPreview/);
    assert.match(source, /manual-segment-preview/);
  });

  it("applies erase outside strokes to the generated cutout photo", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.match(source, /Erase outside/);
    assert.match(source, /erasePhotoPixels\(manualResultPhoto, stroke\)/);
    assert.match(source, /onEraseStrokeComplete/);
    assert.match(source, /manual-erase-stroke/);
    assert.doesNotMatch(source, /eraseStrokes: manual/);
  });

  it("keeps erase outside as a post-cutout cleanup instead of a selection tool", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    const manualEditor = source.match(
      /function ManualCutoutEditor[\s\S]*?function readFileAsDataUrl/,
    )?.[0] ?? "";

    assert.match(source, /manualResultPhoto/);
    assert.match(source, /ResultCleanupEditor/);
    assert.doesNotMatch(manualEditor, /Erase outside/);
    assert.doesNotMatch(manualEditor, /mode === "erase"/);
  });

  it("removes edge trim and clean outline controls from the upload panel", () => {
    const source = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );

    assert.doesNotMatch(source, /Edge trim/);
    assert.doesNotMatch(source, /Apply clean outline/);
    assert.doesNotMatch(source, /manualInset/);
    assert.doesNotMatch(source, /onInsetChange/);
  });

  it("uses MediaPipe interactive segmentation instead of background removal for point prompts", () => {
    const source = readFileSync(
      "lib/pickguard/manualCutout.ts",
      "utf8",
    );

    assert.match(source, /@mediapipe\/tasks-vision/);
    assert.match(source, /InteractiveSegmenter/);
    assert.match(source, /keypoint/);
    assert.match(source, /createPointSegmentedManualCutout/);
  });
});

describe("visualizer copy", () => {
  it("keeps helper copy concise and labels optional AI patterns clearly", () => {
    const visualizer = readFileSync(
      "components/pickguard/PickguardVisualizer.tsx",
      "utf8",
    );
    const uploadPanel = readFileSync(
      "components/pickguard/UploadPanel.tsx",
      "utf8",
    );
    const designGenerator = readFileSync(
      "components/pickguard/DesignGenerator.tsx",
      "utf8",
    );

    assert.doesNotMatch(visualizer, /First version exports visual mockups/);
    assert.doesNotMatch(uploadPanel, /Free browser AI removes backgrounds/);
    assert.match(designGenerator, /AI-generated pickguard pattern \(optional\)/);
    assert.doesNotMatch(designGenerator, /3\. Optional pattern/);
  });

  it("highlights export limitations as current-version-only copy", () => {
    const exportPanel = readFileSync(
      "components/pickguard/ExportPanel.tsx",
      "utf8",
    );
    const css = readFileSync("app/globals.css", "utf8");

    assert.match(exportPanel, /export-current-version-note/);
    assert.match(exportPanel, /Current version/);
    assert.doesNotMatch(exportPanel, /Export files are visual mockups/);
    assert.match(css, /\.export-current-version-note/);
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
