"use client";

import { WandSparkles } from "lucide-react";

import type { GeneratedDesign } from "@/lib/pickguard/patternGenerator";

type DesignGeneratorProps = {
  applyDesign: boolean;
  designs: GeneratedDesign[];
  prompt: string;
  selectedDesignId: string | null;
  onApplyDesignChange: (applyDesign: boolean) => void;
  onGenerate: () => void;
  onPromptChange: (prompt: string) => void;
  onSelectDesign: (designId: string) => void;
};

export function DesignGenerator({
  applyDesign,
  designs,
  prompt,
  selectedDesignId,
  onApplyDesignChange,
  onGenerate,
  onPromptChange,
  onSelectDesign,
}: DesignGeneratorProps) {
  return (
    <section className="panel">
      <h2>3. AI-generated pickguard pattern (optional)</h2>
      <p className="helper-text">
        Current version: sample patterns only. Real AI generation is coming soon.
      </p>
      <div className="prompt-row">
        <textarea
          className="prompt-input"
          placeholder="vintage paisley, red and blue floral, abalone shell, black sacred geometry"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
        />
        <button className="primary-button" type="button" onClick={onGenerate}>
          <WandSparkles aria-hidden size={17} />
          Generate 4 Designs
        </button>
      </div>

      {designs.length > 0 ? (
        <label className="field checkbox-field pattern-toggle">
          <input
            checked={applyDesign}
            type="checkbox"
            onChange={(event) => onApplyDesignChange(event.target.checked)}
          />
          <span>Apply selected pattern</span>
        </label>
      ) : null}

      {designs.length > 0 ? (
        <div className="design-grid">
          {designs.map((design) => (
            <button
              className={`design-card ${
                selectedDesignId === design.id ? "is-selected" : ""
              }`}
              key={design.id}
              type="button"
              onClick={() => {
                onSelectDesign(design.id);
                onApplyDesignChange(true);
              }}
            >
              <img alt="" src={design.imageDataUrl} />
              <strong>{design.label}</strong>
              <span>{design.kind}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="helper-text">Generate patterns only when you need them.</p>
      )}
    </section>
  );
}
