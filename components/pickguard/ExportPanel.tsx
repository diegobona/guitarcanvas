"use client";

import { Code2, FileImage, FileText, ImageDown } from "lucide-react";

type ExportPanelProps = {
  disabled: boolean;
  exporting: string | null;
  onExportMockup: () => Promise<void>;
  onExportPng: () => Promise<void>;
  onExportPdf: () => Promise<void>;
  onExportSvg: () => Promise<void>;
};

export function ExportPanel({
  disabled,
  exporting,
  onExportMockup,
  onExportPng,
  onExportPdf,
  onExportSvg,
}: ExportPanelProps) {
  return (
    <section className="panel">
      <h2>4. Export</h2>
      <div className="export-grid">
        <button
          className="secondary-button"
          disabled
          type="button"
          onClick={() => void onExportMockup()}
        >
          <ImageDown aria-hidden size={17} />
          {exporting === "mockup" ? "Exporting..." : "Export Mockup JPG"}
        </button>
        <button
          className="secondary-button"
          disabled
          type="button"
          onClick={() => void onExportPng()}
        >
          <FileImage aria-hidden size={17} />
          {exporting === "png" ? "Exporting..." : "Export Transparent PNG"}
        </button>
        <button
          className="secondary-button"
          disabled
          type="button"
          onClick={() => void onExportPdf()}
        >
          <FileText aria-hidden size={17} />
          {exporting === "pdf" ? "Exporting..." : "Export Printable PDF"}
        </button>
        <button
          className="secondary-button"
          disabled={disabled || exporting !== null}
          type="button"
          onClick={() => void onExportSvg()}
        >
          <Code2 aria-hidden size={17} />
          {exporting === "svg" ? "Exporting..." : "Export SVG Package"}
        </button>
      </div>
      <p className="export-current-version-note">
        Current version: exports are for visual mockups and print reference only.
        CNC-ready templates and exact screw-hole cutting accuracy are not supported yet.
      </p>
    </section>
  );
}
