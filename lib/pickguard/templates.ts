export type PickguardTemplateId =
  | "strat"
  | "tele"
  | "jazzmaster"
  | "jaguar"
  | "sg"
  | "mustang";

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
    id: "jazzmaster",
    name: "Jazzmaster",
    widthMm: 330,
    heightMm: 235,
    viewBox: "0 0 1000 760",
    outerPath:
      "M119 188 C187 69 333 43 453 92 C537 126 588 183 668 209 C741 233 829 202 892 258 C957 316 948 422 889 482 C829 543 740 542 673 592 C600 646 548 721 447 700 C354 681 340 592 275 553 C209 513 111 549 72 474 C34 401 77 262 119 188 Z",
    holes: [
      { x: 149, y: 200, r: 15 },
      { x: 362, y: 82, r: 15 },
      { x: 570, y: 177, r: 15 },
      { x: 846, y: 277, r: 15 },
      { x: 881, y: 455, r: 15 },
      { x: 675, y: 587, r: 15 },
      { x: 474, y: 680, r: 15 },
      { x: 279, y: 543, r: 15 },
      { x: 86, y: 443, r: 15 },
    ],
    cutouts: [],
  },
  {
    id: "jaguar",
    name: "Jaguar",
    widthMm: 315,
    heightMm: 225,
    viewBox: "0 0 1000 760",
    outerPath:
      "M139 165 C218 68 357 48 472 92 C552 123 590 178 662 203 C735 228 826 197 889 251 C957 308 947 412 889 470 C829 531 733 523 675 578 C611 638 572 717 468 704 C374 692 354 612 289 570 C220 525 112 554 73 482 C32 407 79 238 139 165 Z M721 232 C790 221 847 247 877 293 C816 289 764 274 721 232 Z M95 397 C126 333 160 276 212 229 C214 295 181 352 95 397 Z",
    holes: [
      { x: 166, y: 171, r: 15 },
      { x: 377, y: 83, r: 15 },
      { x: 583, y: 177, r: 15 },
      { x: 814, y: 250, r: 15 },
      { x: 882, y: 431, r: 15 },
      { x: 661, y: 586, r: 15 },
      { x: 493, y: 681, r: 15 },
      { x: 287, y: 557, r: 15 },
      { x: 95, y: 455, r: 15 },
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
  {
    id: "mustang",
    name: "Mustang",
    widthMm: 270,
    heightMm: 205,
    viewBox: "0 0 1000 760",
    outerPath:
      "M181 137 C269 62 417 63 522 130 C606 184 653 221 751 216 C847 211 922 277 918 368 C913 468 830 514 737 503 C663 494 619 527 591 598 C561 675 481 715 403 679 C348 654 328 603 321 548 C312 472 266 434 190 432 C114 430 67 374 82 300 C94 239 132 179 181 137 Z",
    holes: [
      { x: 191, y: 145, r: 15 },
      { x: 443, y: 89, r: 15 },
      { x: 650, y: 214, r: 15 },
      { x: 858, y: 310, r: 15 },
      { x: 784, y: 495, r: 15 },
      { x: 571, y: 613, r: 15 },
      { x: 388, y: 654, r: 15 },
      { x: 315, y: 536, r: 15 },
      { x: 104, y: 333, r: 15 },
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
