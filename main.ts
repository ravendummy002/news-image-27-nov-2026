// World News in One Day: Friday 27 November 2026
// A newspaper front page drawn as a 1024x1024 PNG.
// Node 22, standard library only. No network, no randomness, no clock:
// two runs produce byte-identical output.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

// ---------------------------------------------------------------- font --
// Hand-drawn 5x7 bitmap font. Each glyph is 7 rows of 5 cells ("1" = ink).
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "\u2022": ["00000", "00100", "01110", "01110", "01110", "00100", "00000"],
};

const BLANK = ["00000", "00000", "00000", "00000", "00000", "00000", "00000"];

// -------------------------------------------------------------- canvas --
class Page {
  data = new Uint8Array(W * H * 3);

  fill(c: RGB): void {
    for (let i = 0; i < W * H; i++) {
      this.data[i * 3] = c[0];
      this.data[i * 3 + 1] = c[1];
      this.data[i * 3 + 2] = c[2];
    }
  }

  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) this.px(i, j, c);
    }
  }

  hline(x: number, y: number, w: number, c: RGB): void {
    this.rect(x, y, w, 1, c);
  }

  // Filled circle.
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy));
      this.rect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
    }
  }

  // Filled polygon (even-odd scanline fill).
  poly(pts: Array<[number, number]>, c: RGB): void {
    let minY = H;
    let maxY = 0;
    for (const [, y] of pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          xs.push(Math.round(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        this.rect(xs[k], y, xs[k + 1] - xs[k] + 1, 1, c);
      }
    }
  }

  // ------------------------------------------------------------ text --
  textWidth(text: string, scale: number): number {
    return text.length * 6 * scale - scale;
  }

  drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
    const g = FONT[ch] ?? BLANK;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") {
          this.rect(x + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }

  drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
    let cx = x;
    for (const ch of text) {
      this.drawChar(cx, y, ch, scale, c);
      cx += 6 * scale;
    }
  }

  drawTextCentered(y: number, text: string, scale: number, c: RGB): void {
    const x = Math.round((W - this.textWidth(text, scale)) / 2);
    this.drawText(x, y, text, scale, c);
  }

  // Greedy word wrap; returns lines that fit maxW pixels.
  wrap(text: string, maxW: number, scale: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const word of words) {
      const trial = cur === "" ? word : cur + " " + word;
      if (this.textWidth(trial, scale) <= maxW || cur === "") {
        cur = trial;
      } else {
        lines.push(cur);
        cur = word;
      }
    }
    if (cur !== "") lines.push(cur);
    return lines;
  }
}

// ----------------------------------------------------------------- PNG --
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(p: Page): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(p.data.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// -------------------------------------------------------------- palette --
const PAPER: RGB = [246, 241, 227];
const PANEL: RGB = [255, 253, 244];
const INK: RGB = [20, 20, 20];
const RED: RGB = [163, 22, 33];
const NAVY: RGB = [29, 53, 87];
const TEAL: RGB = [15, 118, 110];
const OCHRE: RGB = [180, 83, 9];
const GREEN: RGB = [45, 106, 79];
const SLATE: RGB = [51, 65, 85];
const GREY: RGB = [120, 113, 96];
const ORANGE: RGB = [208, 96, 24];
const WHITE: RGB = [255, 255, 255];

// -------------------------------------------------------------- stories --
// Only the verified stories of Friday 27 November 2026. The Kuwait and
// Jazan attacks happened on Thursday and were first reported on Friday.
const LEAD_BODY =
  "FIRST REPORTED FRIDAY: AN IRANIAN DRONE ATTACK ON A KUWAIT MILITARY SITE " +
  "KILLED TWO ITALIAN TECHNICIANS. KUWAIT AND ITALY BLAME IRAN; IRAN DENIES IT. " +
  "A PROJECTILE HIT SAUDI ARABIA'S JAZAN REFINERY, KILLING A NEPALI WORKER. " +
  "THE US DISABLED THE SHIP PACIFIC ARCHER IN THE GULF OF OMAN, THE 15TH " +
  "VESSEL STOPPED UNDER THE BLOCKADE. BRENT CRUDE NEAR $97 A BARREL.";

interface Panel {
  head: string;
  body: string;
  accent: RGB;
}

const PANELS: Panel[] = [
  {
    head: "EU SUMMIT DEADLOCK",
    body: "LEADERS ENDED A 12-HOUR-PLUS BRUSSELS SUMMIT WITH NO DEAL ON THE 2028-2034 BUDGET OR A 45BN EURO UKRAINE LOAN. TALKS RESUME IN DECEMBER.",
    accent: NAVY,
  },
  {
    head: "ZELENSKYY VS TRUMP",
    body: "ZELENSKYY CALLED IT STRANGE THAT TRUMP CALLS PUTIN A FRIEND, IN A BBC INTERVIEW ON FRIDAY. TRUMP REPLIED HE WANTS A DEAL, NOT A FEUD.",
    accent: RED,
  },
  {
    head: "BLACK FRIDAY RALLY",
    body: "S&P 500 +1.6%, NASDAQ +2.3%, DOW +1.2% IN THE HALF-DAY SESSION. BEST WEEK IN OVER A YEAR AS CHIP STOCKS LED. ONLINE SALES ON TRACK PAST $13BN.",
    accent: GREEN,
  },
  {
    head: "THANKSGIVING STORM",
    body: "A STORM LASHED THE US EAST COAST WITH FLOODING AND HIGH WINDS, CUTTING POWER TO MORE THAN 800,000 CUSTOMERS. CLEAN-UP IS UNDER WAY.",
    accent: SLATE,
  },
  {
    head: "CHINA STOCKS SOAR",
    body: "SHANGHAI +3.7% AND STAR 50 +15% AFTER A STATE COUNCIL MEETING BACKED MORE STATE INVESTMENT. OCTOBER INDUSTRIAL PROFITS ROSE 20.1%.",
    accent: RED,
  },
  {
    head: "UKRAINE STRIKES",
    body: "UKRAINIAN DRONES HIT A RUSSIAN OIL PIPELINE HUB, A REFINERY AND A POWER PLANT OVERNIGHT, AND A PLANT SUPPLYING THE NORTH CAUCASUS.",
    accent: OCHRE,
  },
  {
    head: "MEXICO VS DEA",
    body: "MEXICO FILED A FORMAL COMPLAINT WITH WASHINGTON OVER A DEA TIP LINE ASKING MEXICANS TO REPORT TRAFFICKERS AND CORRUPT OFFICIALS.",
    accent: TEAL,
  },
  {
    head: "SPAIN VOTES SUNDAY",
    body: "CAMPAIGNING ENDED ON FRIDAY AHEAD OF SUNDAY'S SNAP GENERAL ELECTION.",
    accent: NAVY,
  },
  {
    head: "NEW ZEALAND",
    body: "FINAL RESULTS: PM LUXON'S CENTRE-RIGHT COALITION WON 65 OF 130 SEATS, ONE SHORT OF A MAJORITY.",
    accent: GREEN,
  },
  {
    head: "SAP CYBER INCIDENT",
    body: "SAP CONFIRMED A SECURITY INCIDENT AND SAYS IT HAS NO EVIDENCE CUSTOMER DATA WAS ACCESSED.",
    accent: SLATE,
  },
  {
    head: "US TRADE GAP",
    body: "THE US GOODS TRADE DEFICIT WIDENED TO A RECORD $149.5BN IN OCTOBER AS IMPORTS HIT A RECORD.",
    accent: OCHRE,
  },
];

const NUMBERS_LINES = [
  "BRENT CRUDE NEAR $97",
  "STAR 50 +15%",
  "800,000 WITHOUT POWER",
  "$149.5BN US TRADE GAP",
];

// -------------------------------------------------------------- drawing --
function drawMasthead(p: Page): void {
  p.rect(24, 12, 976, 2, INK);
  p.drawTextCentered(22, "THE WORLD IN ONE DAY", 2, INK);
  p.drawTextCentered(52, "FRIDAY 27 NOVEMBER 2026", 6, INK);
  p.rect(24, 100, 976, 4, INK);
  p.rect(24, 107, 976, 2, INK);
}

// Simple tanker pictogram with containers, a flame and a Brent price badge.
function drawShip(p: Page): void {
  // Smoke puffs above the bridge, clear of the price badge.
  p.disc(884, 182, 9, GREY);
  p.disc(872, 164, 7, GREY);
  p.disc(862, 148, 5, GREY);
  // Bridge tower.
  p.rect(898, 196, 52, 74, NAVY);
  p.rect(906, 208, 36, 10, WHITE);
  p.rect(906, 226, 36, 10, WHITE);
  // Containers.
  p.rect(700, 232, 58, 38, RED);
  p.rect(764, 232, 58, 38, OCHRE);
  p.rect(828, 232, 58, 38, TEAL);
  p.rect(700, 196, 58, 32, TEAL);
  p.rect(764, 196, 58, 32, RED);
  // Flame licking above the first stack.
  p.poly(
    [
      [716, 196],
      [726, 168],
      [734, 186],
      [744, 162],
      [752, 196],
    ],
    ORANGE,
  );
  // Hull.
  p.poly(
    [
      [688, 270],
      [962, 270],
      [934, 312],
      [716, 312],
    ],
    INK,
  );
  p.rect(688, 270, 274, 4, RED);
  // Water line and dashes.
  p.hline(680, 322, 290, NAVY);
  p.rect(700, 330, 60, 3, NAVY);
  p.rect(800, 330, 60, 3, NAVY);
  p.rect(900, 330, 60, 3, NAVY);
  // Brent price badge, kept inside the lead panel below the masthead rules.
  p.disc(918, 156, 34, RED);
  p.drawText(903, 136, "BRENT", 1, WHITE);
  p.drawText(893, 148, "$97", 3, WHITE);
  // Caption.
  p.drawText(700, 344, "PACIFIC ARCHER DISABLED IN THE GULF OF OMAN", 1, INK);
}

function drawLead(p: Page): void {
  const y0 = 116;
  const y1 = 384;
  p.rect(24, y0, 976, y1 - y0, PANEL);
  p.rect(24, y0, 976, 1, INK);
  p.rect(24, y1 - 1, 976, 1, INK);
  p.rect(24, y0, 1, y1 - y0, INK);
  p.rect(999, y0, 1, y1 - y0, INK);
  p.rect(24, y0, 10, y1 - y0, RED);
  p.drawText(48, 130, "LEAD STORY - THE GULF", 2, RED);
  p.drawText(48, 152, "GULF ESCALATION", 4, INK);
  const lines = p.wrap(LEAD_BODY, 600, 2);
  let y = 194;
  for (const line of lines) {
    p.drawText(48, y, line, 2, INK);
    y += 17;
  }
  drawShip(p);
  p.hline(48, 356, 928, INK);
  p.drawText(48, 366, "BRENT CRUDE NEAR $97 - 15TH VESSEL DISABLED - TWO ITALIANS KILLED", 2, INK);
}

function drawPanel(p: Page, x: number, y: number, w: number, h: number, panel: Panel): void {
  p.rect(x, y, w, h, PANEL);
  p.rect(x, y, w, 1, INK);
  p.rect(x, y + h - 1, w, 1, INK);
  p.rect(x, y, 1, h, INK);
  p.rect(x + w - 1, y, 1, h, INK);
  p.rect(x, y, w, 6, panel.accent);
  p.drawText(x + 10, y + 14, panel.head, 2, panel.accent);
  const lines = p.wrap(panel.body, w - 20, 2);
  let ly = y + 36;
  for (const line of lines) {
    p.drawText(x + 10, ly, line, 2, INK);
    ly += 15;
  }
}

function drawNumbersBox(p: Page, x: number, y: number, w: number, h: number): void {
  p.rect(x, y, w, h, NAVY);
  p.drawText(x + 10, y + 12, "THE DAY IN NUMBERS", 2, WHITE);
  let ly = y + 36;
  for (const line of NUMBERS_LINES) {
    p.drawText(x + 10, ly, line, 2, WHITE);
    ly += 17;
  }
}

function drawFooter(p: Page): void {
  p.drawTextCentered(976, "THANKSGIVING ONLINE SPENDING HIT A RECORD $7.1BN", 2, INK);
  p.drawTextCentered(1000, "THE WORLD IN ONE DAY - FRIDAY 27 NOVEMBER 2026", 1, INK);
}

// ------------------------------------------------------------------ main --
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const page = new Page();
  page.fill(PAPER);
  drawMasthead(page);
  drawLead(page);

  // Grid: 3 columns x 4 rows of story panels; the 12th cell is a numbers box.
  const gx = 24;
  const gy = 396;
  const cw = 318;
  const ch = 135;
  const gap = 11;
  for (let i = 0; i < 12; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = gx + col * (cw + gap);
    const y = gy + row * (ch + gap);
    if (i < PANELS.length) {
      drawPanel(page, x, y, cw, ch, PANELS[i]);
    } else {
      drawNumbersBox(page, x, y, cw, ch);
    }
  }

  drawFooter(page);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), encodePNG(page));
}

main();
