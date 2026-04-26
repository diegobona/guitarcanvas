import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateDesigns } from "../lib/pickguard/patternGenerator";
import { pickguardTemplates } from "../lib/pickguard/templates";
import { buildStringOverlaySvg, buildSvgPackage } from "../lib/pickguard/exporters";
import {
  clampStringGuidePoint,
  getInitialStringOverlay,
} from "../lib/pickguard/geometry";

describe("pickguard template data", () => {
  it("ships the three MVP templates with replaceable SVG metadata", () => {
    assert.deepEqual(
      pickguardTemplates.map((template) => template.id),
      ["strat", "tele", "sg"],
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
