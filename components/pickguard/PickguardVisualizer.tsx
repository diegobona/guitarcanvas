"use client";

import { useMemo, useState } from "react";

import { DesignGenerator } from "./DesignGenerator";
import { EditorCanvas } from "./EditorCanvas";
import { ExportPanel } from "./ExportPanel";
import { TemplateSelector } from "./TemplateSelector";
import { UploadPanel } from "./UploadPanel";
import type { GeneratedDesign } from "@/lib/pickguard/patternGenerator";
import { generateDesigns } from "@/lib/pickguard/patternGenerator";
import {
  getTemplateById,
  type PickguardTemplateId,
} from "@/lib/pickguard/templates";
import {
  exportMockupJpg,
  exportPrintablePdf,
  exportSvgPackage,
  exportTransparentPng,
} from "@/lib/pickguard/exporters";
import {
  getInitialStringOverlay,
  getInitialTransform,
  type PickguardTransform,
  type StringOverlay,
  type UploadedPhoto,
} from "@/lib/pickguard/geometry";

const defaultPrompt =
  "vintage paisley, red and blue floral, abalone shell, black sacred geometry";

export function PickguardVisualizer() {
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null);
  const [templateId, setTemplateId] = useState<PickguardTemplateId>("strat");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [designs, setDesigns] = useState<GeneratedDesign[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [transform, setTransform] = useState<PickguardTransform>({
    x: 420,
    y: 300,
    scale: 1,
    rotation: 0,
  });
  const [stringOverlay, setStringOverlay] = useState<StringOverlay | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const template = getTemplateById(templateId);
  const selectedDesign = useMemo(
    () => designs.find((design) => design.id === selectedDesignId) ?? null,
    [designs, selectedDesignId],
  );

  function handlePhotoLoaded(nextPhoto: UploadedPhoto) {
    setPhoto(nextPhoto);
    setTransform(getInitialTransform(nextPhoto));
    setStringOverlay(getInitialStringOverlay(nextPhoto));
  }

  function handleGenerate() {
    const nextDesigns = generateDesigns(prompt);
    setDesigns(nextDesigns);
    setSelectedDesignId(nextDesigns[0]?.id ?? null);
  }

  async function runExport(
    key: string,
    exporter: () => Promise<void>,
  ): Promise<void> {
    try {
      setExporting(key);
      await exporter();
    } finally {
      setExporting(null);
    }
  }

  const canExport = Boolean(photo && selectedDesign);

  return (
    <main className="visualizer-page">
      <section className="visualizer-hero">
        <p className="eyebrow">GuitarCanvas</p>
        <h1>AI Guitar Pickguard Visualizer</h1>
        <p>
          Upload your guitar photo, try custom pickguard designs, and export
          printable design files.
        </p>
        <div className="disclaimer">
          First version exports visual mockups and print-reference files. It
          does not guarantee exact screw-hole or CNC cutting accuracy.
        </div>
      </section>

      <section className="visualizer-grid" aria-label="Pickguard visualizer">
        <div className="control-stack">
          <UploadPanel photo={photo} onPhotoLoaded={handlePhotoLoaded} />
          <TemplateSelector
            selectedTemplateId={templateId}
            onSelectTemplate={setTemplateId}
          />
          <DesignGenerator
            designs={designs}
            prompt={prompt}
            selectedDesignId={selectedDesignId}
            onGenerate={handleGenerate}
            onPromptChange={setPrompt}
            onSelectDesign={setSelectedDesignId}
          />
          <ExportPanel
            disabled={!canExport}
            exporting={exporting}
            onExportMockup={() => {
              if (!photo || !selectedDesign) return Promise.resolve();
              return runExport("mockup", () =>
                exportMockupJpg({
                  photo,
                  template,
                  design: selectedDesign,
                  transform,
                  stringOverlay: stringOverlay ?? undefined,
                }),
              );
            }}
            onExportPdf={() => {
              if (!selectedDesign) return Promise.resolve();
              return runExport("pdf", () =>
                exportPrintablePdf({ template, design: selectedDesign }),
              );
            }}
            onExportPng={() => {
              if (!selectedDesign) return Promise.resolve();
              return runExport("png", () =>
                exportTransparentPng({ template, design: selectedDesign }),
              );
            }}
            onExportSvg={() => {
              if (!selectedDesign) return Promise.resolve();
              return runExport("svg", () =>
                exportSvgPackage({ template, design: selectedDesign }),
              );
            }}
          />
        </div>

        <EditorCanvas
          design={selectedDesign}
          photo={photo}
          template={template}
          transform={transform}
          stringOverlay={stringOverlay}
          onTransformChange={setTransform}
          onStringOverlayChange={setStringOverlay}
        />
      </section>
    </main>
  );
}
