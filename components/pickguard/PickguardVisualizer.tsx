"use client";

import { useState } from "react";

import { DesignGenerator } from "./DesignGenerator";
import { EditorCanvas } from "./EditorCanvas";
import { ExportPanel } from "./ExportPanel";
import { UploadPanel, type PickguardSourceMode } from "./UploadPanel";
import { getTemplateById } from "@/lib/pickguard/templates";
import { exportMockupJpg } from "@/lib/pickguard/exporters";
import {
  getInitialStringOverlay,
  getInitialStickerTransform,
  getInitialTransform,
  type PickguardTransform,
  type StickerTransform,
  type StringOverlay,
  type UploadedPhoto,
} from "@/lib/pickguard/geometry";
import {
  generateDesigns,
  type GeneratedDesign,
} from "@/lib/pickguard/patternGenerator";

export function PickguardVisualizer() {
  const [photo, setPhoto] = useState<UploadedPhoto | null>(null);
  const [pickguardPhoto, setPickguardPhoto] = useState<UploadedPhoto | null>(
    null,
  );
  const [prompt, setPrompt] = useState("");
  const [designs, setDesigns] = useState<GeneratedDesign[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [applyGeneratedDesign, setApplyGeneratedDesign] = useState(false);
  const [transform, setTransform] = useState<PickguardTransform>({
    x: 420,
    y: 300,
    scale: 1,
    rotation: 0,
  });
  const [stickerTransform, setStickerTransform] = useState<StickerTransform>({
    x: 420,
    y: 300,
    scale: 1,
    rotation: 0,
  });
  const [stringOverlay, setStringOverlay] = useState<StringOverlay | null>(null);
  const [pickguardPhotoSourceMode, setPickguardPhotoSourceMode] =
    useState<PickguardSourceMode>("single");
  const [exporting, setExporting] = useState<string | null>(null);

  const template = getTemplateById("strat");
  const selectedDesign =
    designs.find((design) => design.id === selectedDesignId) ?? null;
  const activeDesign =
    applyGeneratedDesign && pickguardPhoto ? selectedDesign : null;

  function handlePhotoLoaded(nextPhoto: UploadedPhoto) {
    setPhoto(nextPhoto);
    setTransform(getInitialTransform(nextPhoto));
    setStickerTransform(getInitialStickerTransform(nextPhoto));
    setStringOverlay({
      ...getInitialStringOverlay(nextPhoto),
      enabled: pickguardPhotoSourceMode === "single",
    });
  }

  function handlePickguardPhotoLoaded(
    nextPhoto: UploadedPhoto,
    sourceMode?: PickguardSourceMode,
  ) {
    setPickguardPhoto(nextPhoto);
    if (sourceMode) {
      setPickguardPhotoSourceMode(sourceMode);
    }
    if (photo) {
      setStickerTransform(getInitialStickerTransform(photo));
      if (sourceMode) {
        setStringOverlay((currentOverlay) => ({
          ...(currentOverlay ?? getInitialStringOverlay(photo)),
          enabled: sourceMode === "single",
        }));
      }
    }
  }

  function handleGenerateDesigns() {
    const nextDesigns = generateDesigns(prompt);
    setDesigns(nextDesigns);
    setSelectedDesignId(nextDesigns[0]?.id ?? null);
    setApplyGeneratedDesign(true);
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

  const canExport = Boolean(photo && pickguardPhoto);

  return (
    <main className="visualizer-page">
      <section className="visualizer-hero">
        <p className="eyebrow">GuitarCanvas</p>
        <h1>AI Guitar Pickguard Visualizer</h1>
        <p>
          Upload your guitar photo, try custom pickguard designs, and export
          printable design files.
        </p>
      </section>

      <section className="visualizer-grid" aria-label="Pickguard visualizer">
        <div className="control-stack">
          <UploadPanel
            emptyLabel="Upload guitar photo"
            errorLabel="Please upload a JPG or PNG guitar photo."
            photo={photo}
            replaceLabel="Replace guitar photo"
            title="1. Guitar photo"
            onPhotoLoaded={handlePhotoLoaded}
          />
          <UploadPanel
            allowPickguardSourceMode
            emptyLabel="Upload pickguard photo"
            errorLabel="Please upload a JPG or PNG pickguard photo."
            photo={pickguardPhoto}
            replaceLabel="Replace pickguard photo"
            removeBackground
            title="2. Pickguard photo"
            onPhotoLoaded={handlePickguardPhotoLoaded}
          />
          <DesignGenerator
            applyDesign={applyGeneratedDesign}
            designs={designs}
            prompt={prompt}
            selectedDesignId={selectedDesignId}
            onApplyDesignChange={setApplyGeneratedDesign}
            onGenerate={handleGenerateDesigns}
            onPromptChange={setPrompt}
            onSelectDesign={setSelectedDesignId}
          />
          <ExportPanel
            disabled={!canExport}
            exporting={exporting}
            onExportMockup={() => {
              if (!photo || !pickguardPhoto) return Promise.resolve();
              return runExport("mockup", () =>
                exportMockupJpg({
                  photo,
                  template,
                  pickguardPhoto,
                  stickerTransform,
                  overlayDesign: activeDesign ?? undefined,
                  stringOverlay: stringOverlay ?? undefined,
                }),
              );
            }}
            onExportPdf={() => Promise.resolve()}
            onExportPng={() => Promise.resolve()}
            onExportSvg={() => Promise.resolve()}
          />
        </div>

        <EditorCanvas
          design={activeDesign}
          photo={photo}
          pickguardPhoto={pickguardPhoto}
          template={template}
          transform={transform}
          stickerTransform={stickerTransform}
          stringOverlay={stringOverlay}
          onTransformChange={setTransform}
          onStickerTransformChange={setStickerTransform}
          onStringOverlayChange={setStringOverlay}
        />
      </section>
    </main>
  );
}
