"use client";

import { WandSparkles } from "lucide-react";

import type { GeneratedDesign } from "@/lib/pickguard/patternGenerator";

type DesignGeneratorProps = {
  designs: GeneratedDesign[];
  prompt: string;
  selectedDesignId: string | null;
  onGenerate: () => void;
  onPromptChange: (prompt: string) => void;
  onSelectDesign: (designId: string) => void;
};

export function DesignGenerator({
  designs,
  prompt,
  selectedDesignId,
  onGenerate,
  onPromptChange,
  onSelectDesign,
}: DesignGeneratorProps) {
  return (
    <section className="panel">
      <h2>3. Design prompt</h2>
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
        <div className="design-grid">
          {designs.map((design) => (
            <button
              className={`design-card ${
                selectedDesignId === design.id ? "is-selected" : ""
              }`}
              key={design.id}
              type="button"
              onClick={() => onSelectDesign(design.id)}
            >
              <img alt="" src={design.imageDataUrl} />
              <strong>{design.label}</strong>
              <span>{design.kind}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="helper-text">
          Local procedural designs stand in for future AI image generation.
        </p>
      )}
    </section>
  );
}
