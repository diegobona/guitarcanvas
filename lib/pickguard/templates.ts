export type PickguardTemplateId = "strat" | "tele" | "sg";

export type PickguardHole = {
  x: number;
  y: number;
  r: number;
};

export type PickguardCutout = {
  id: string;
  path: string;
};

export type PickguardTemplate = {
  id: PickguardTemplateId;
  name: string;
  widthMm: number;
  heightMm: number;
  viewBox: string;
  outerPath: string;
  holes: PickguardHole[];
  cutouts: PickguardCutout[];
};

export const pickguardTemplates: PickguardTemplate[] = [
  {
    id: "strat",
    name: "Stratocaster",
    widthMm: 285,
    heightMm: 220,
    viewBox: "0 0 1000 760",
    outerPath:
      "M136 88 C220 30 365 44 478 104 C552 143 631 166 725 158 C829 149 908 204 923 291 C939 385 885 456 792 487 C726 509 695 558 692 631 C688 711 622 747 544 723 C488 706 450 663 421 615 C382 550 333 532 261 559 C166 595 79 548 65 459 C52 378 94 328 162 293 C224 261 232 214 184 166 C164 146 147 122 136 88 Z",
    holes: [
      { x: 157, y: 104, r: 15 },
      { x: 415, y: 76, r: 15 },
      { x: 745, y: 190, r: 15 },
      { x: 885, y: 316, r: 15 },
      { x: 773, y: 474, r: 15 },
      { x: 650, y: 681, r: 15 },
      { x: 401, y: 602, r: 15 },
      { x: 171, y: 521, r: 15 },
      { x: 169, y: 302, r: 15 },
    ],
    cutouts: [],
  },
  {
    id: "tele",
    name: "Telecaster",
    widthMm: 245,
    heightMm: 190,
    viewBox: "0 0 1000 760",
    outerPath:
      "M167 135 C247 63 381 43 498 79 C603 111 682 172 759 245 C846 327 905 440 860 543 C817 642 700 700 585 694 C480 688 420 640 371 566 C333 508 277 477 210 476 C125 475 77 418 91 334 C103 263 117 180 167 135 Z",
    holes: [
      { x: 183, y: 153, r: 15 },
      { x: 458, y: 84, r: 15 },
      { x: 745, y: 261, r: 15 },
      { x: 839, y: 513, r: 15 },
      { x: 604, y: 657, r: 15 },
      { x: 324, y: 535, r: 15 },
      { x: 125, y: 350, r: 15 },
    ],
    cutouts: [],
  },
  {
    id: "sg",
    name: "SG",
    widthMm: 230,
    heightMm: 205,
    viewBox: "0 0 1000 760",
    outerPath:
      "M205 128 C295 55 440 70 512 161 C567 231 637 239 728 219 C833 196 927 257 930 360 C933 452 851 510 766 491 C684 473 629 497 603 578 C573 671 485 723 393 682 C318 648 294 578 306 500 C320 410 280 360 190 351 C112 343 67 279 95 211 C114 166 157 154 205 128 Z",
    holes: [
      { x: 214, y: 142, r: 15 },
      { x: 506, y: 166, r: 15 },
      { x: 772, y: 236, r: 15 },
      { x: 891, y: 367, r: 15 },
      { x: 741, y: 479, r: 15 },
      { x: 503, y: 659, r: 15 },
      { x: 318, y: 505, r: 15 },
      { x: 129, y: 241, r: 15 },
    ],
    cutouts: [],
  },
];

export function getTemplateById(id: PickguardTemplateId): PickguardTemplate {
  return (
    pickguardTemplates.find((template) => template.id === id) ??
    pickguardTemplates[0]
  );
}

export function parseViewBox(viewBox: string) {
  const [minX, minY, width, height] = viewBox.split(/\s+/).map(Number);

  return { minX, minY, width, height };
}
