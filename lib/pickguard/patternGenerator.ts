export type GeneratedDesignKind =
  | "paisley"
  | "abalone"
  | "tortoise"
  | "geometry";

export type GeneratedDesign = {
  id: string;
  label: string;
  kind: GeneratedDesignKind;
  prompt: string;
  imageDataUrl: string;
};

export function generateDesigns(prompt: string): GeneratedDesign[] {
  const normalizedPrompt = prompt.trim() || "custom pickguard design";

  return [
    {
      id: "local-paisley",
      label: "Paisley Floral",
      kind: "paisley",
      prompt,
      imageDataUrl: svgToDataUrl(buildPaisleySvg(normalizedPrompt)),
    },
    {
      id: "local-abalone",
      label: "Abalone Pearl",
      kind: "abalone",
      prompt,
      imageDataUrl: svgToDataUrl(buildAbaloneSvg(normalizedPrompt)),
    },
    {
      id: "local-tortoise",
      label: "Tortoise Shell",
      kind: "tortoise",
      prompt,
      imageDataUrl: svgToDataUrl(buildTortoiseSvg(normalizedPrompt)),
    },
    {
      id: "local-geometry",
      label: "Sacred Geometry",
      kind: "geometry",
      prompt,
      imageDataUrl: svgToDataUrl(buildGeometrySvg(normalizedPrompt)),
    },
  ];
}

function svgToDataUrl(svg: string) {
  if (typeof window === "undefined") {
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }

  return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
}

function buildPaisleySvg(prompt: string) {
  return wrapPatternSvg(`
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#742124"/>
        <stop offset="0.5" stop-color="#d8a64f"/>
        <stop offset="1" stop-color="#234b63"/>
      </linearGradient>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0.32"/><feBlend mode="soft-light" in2="SourceGraphic"/></filter>
    </defs>
    <rect width="1200" height="850" fill="url(#g)"/>
    ${Array.from({ length: 12 }, (_, index) => {
      const x = 90 + (index % 4) * 300;
      const y = 70 + Math.floor(index / 4) * 255;
      return `<path d="M${x} ${y + 95} C${x + 80} ${y - 30} ${x + 230} ${y + 10} ${x + 176} ${y + 153} C${x + 129} ${y + 271} ${x - 32} ${y + 246} ${x} ${y + 95} Z" fill="none" stroke="#fff3c2" stroke-width="12" opacity="0.55"/>
      <circle cx="${x + 105}" cy="${y + 115}" r="36" fill="#0f2430" opacity="0.42"/>
      <path d="M${x + 42} ${y + 92} C${x + 88} ${y + 72} ${x + 116} ${y + 88} ${x + 145} ${y + 132}" fill="none" stroke="#f9df92" stroke-width="8" opacity="0.7"/>`;
    }).join("")}
    <g filter="url(#grain)" opacity="0.55"><rect width="1200" height="850" fill="#ffffff"/></g>
    <text x="42" y="804" fill="#fff7d0" font-size="34" font-family="Arial" opacity="0.55">${escapeXml(prompt)}</text>
  `);
}

function buildAbaloneSvg(prompt: string) {
  return wrapPatternSvg(`
    <defs>
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.045" numOctaves="4"/>
        <feDisplacementMap in="SourceGraphic" scale="70"/>
      </filter>
      <radialGradient id="shell" cx="50%" cy="45%" r="80%">
        <stop offset="0" stop-color="#fff4cc"/>
        <stop offset="0.22" stop-color="#7de4d5"/>
        <stop offset="0.45" stop-color="#7285e8"/>
        <stop offset="0.72" stop-color="#f07ab7"/>
        <stop offset="1" stop-color="#22314d"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="850" fill="#0c1726"/>
    <g filter="url(#noise)">
      ${Array.from({ length: 26 }, (_, index) => {
        const x = (index * 143) % 1220;
        const y = (index * 97) % 880;
        const r = 130 + ((index * 19) % 90);
        return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.42}" fill="url(#shell)" opacity="0.64" transform="rotate(${index * 23} ${x} ${y})"/>`;
      }).join("")}
    </g>
    <path d="M0 260 C220 130 372 404 594 228 C781 80 952 222 1200 112 L1200 850 L0 850 Z" fill="#ffffff" opacity="0.1"/>
    <text x="42" y="804" fill="#effbff" font-size="34" font-family="Arial" opacity="0.5">${escapeXml(prompt)}</text>
  `);
}

function buildTortoiseSvg(prompt: string) {
  return wrapPatternSvg(`
    <defs>
      <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <rect width="1200" height="850" fill="#2a1208"/>
    ${Array.from({ length: 42 }, (_, index) => {
      const x = (index * 173) % 1210;
      const y = (index * 109) % 860;
      const rx = 70 + ((index * 31) % 150);
      const ry = 45 + ((index * 17) % 120);
      const colors = ["#f4b25e", "#7d3518", "#190b05", "#c7652b"];
      return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${colors[index % colors.length]}" opacity="${0.42 + (index % 5) * 0.08}" filter="url(#soft)" transform="rotate(${index * 29} ${x} ${y})"/>`;
    }).join("")}
    <rect width="1200" height="850" fill="#3a1709" opacity="0.22"/>
    <text x="42" y="804" fill="#ffd08a" font-size="34" font-family="Arial" opacity="0.52">${escapeXml(prompt)}</text>
  `);
}

function buildGeometrySvg(prompt: string) {
  return wrapPatternSvg(`
    <rect width="1200" height="850" fill="#090909"/>
    <g stroke="#f6f1e8" stroke-width="6" fill="none" opacity="0.86">
      ${Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: 12 }, (_, col) => {
          const cx = 70 + col * 105 + (row % 2) * 52;
          const cy = 52 + row * 92;
          return `<polygon points="${cx},${cy - 44} ${cx + 38},${cy - 22} ${cx + 38},${cy + 22} ${cx},${cy + 44} ${cx - 38},${cy + 22} ${cx - 38},${cy - 22}"/>
          <circle cx="${cx}" cy="${cy}" r="35"/>
          <path d="M${cx - 44} ${cy} H${cx + 44} M${cx} ${cy - 44} V${cy + 44}"/>`;
        }).join(""),
      ).join("")}
    </g>
    <g stroke="#d7a84f" stroke-width="3" opacity="0.52">
      <path d="M0 140 C242 44 382 274 598 153 C831 22 970 274 1200 120"/>
      <path d="M0 706 C242 610 382 840 598 719 C831 588 970 840 1200 686"/>
    </g>
    <text x="42" y="804" fill="#f6f1e8" font-size="34" font-family="Arial" opacity="0.46">${escapeXml(prompt)}</text>
  `);
}

function wrapPatternSvg(content: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850">${content}</svg>`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
