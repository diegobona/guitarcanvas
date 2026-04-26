"use client";

import { Shapes } from "lucide-react";

import {
  pickguardTemplates,
  type PickguardTemplateId,
} from "@/lib/pickguard/templates";

type TemplateSelectorProps = {
  selectedTemplateId: PickguardTemplateId;
  onSelectTemplate: (templateId: PickguardTemplateId) => void;
};

export function TemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
}: TemplateSelectorProps) {
  return (
    <section className="panel">
      <h2>2. Pickguard template</h2>
      <div className="template-grid">
        {pickguardTemplates.map((template) => (
          <button
            className={`template-button ${
              selectedTemplateId === template.id ? "is-selected" : ""
            }`}
            key={template.id}
            type="button"
            onClick={() => onSelectTemplate(template.id)}
          >
            <strong>
              <Shapes aria-hidden size={16} /> {template.name}
            </strong>
            <span>
              {template.widthMm} × {template.heightMm}mm reference
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
