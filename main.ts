// World News in One Day: Friday 27 November 2026
// A newspaper front page drawn entirely in code: own rasterizer,
// own 5x7 bitmap font, own palette PNG encoder with LZ77 + fixed
// Huffman DEFLATE. Node 22, standard library only, no network.
// Deterministic: two runs produce byte-identical output.

import * as fs from "node:fs";
import * as path from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
// 0 paper, 1 ink, 2 red, 3 navy, 4 grey, 5 sand, 6 orange, 7 green,
// 8 gold, 9 sky, 10 slate, 11 white
const PALETTE: Array<[number, number, number]> = [
  [246, 241, 227], // 0 paper
  [17, 17, 17],    // 1 ink
  [176, 32, 32],   // 2 red
  [31, 78, 121],   // 3 navy
  [138, 133, 120], // 4 grey
  [216, 210, 192], // 5 sand
  [208, 96, 24],   // 6 orange
  [46, 107, 52],   // 7 green
  [200, 160, 24],  // 8 gold
  [127, 168, 201], // 9 sky
  [85, 85, 80],    // 10 slate
  [255, 255, 255], // 11 white
];

const buf = new Uint8Array(W * H); // palette indices, starts as paper (0)

function setPx(x: number, y: number, c: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  buf[y * W + x] = c;
}

function fillRect(x: number, y: number, w: number, h: number, c: number): void {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    const row = yy * W;
    for (let xx = x0; xx < x1; xx++) buf[row + xx] = c;
  }
}

function hline(x: number, y: number, w: number, c: number, t = 1): void {
  fillRect(x, y, w, t, c);
}

function vline(x: number, y: number, h: number, c: number, t = 1): void {
  fillRect(x, y, t, h, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: number): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function circle(cx: number, cy: number, r: number, c: number, fill: boolean): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (fill ? d <= r : Math.abs(d - r) < 0.9) setPx(cx + x, cy + y, c);
    }
  }
}

function triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
      const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) setPx(x, y, c);
    }
  }
}

// ------------------------------------------------------------- bitmap font
// 5x7 glyphs, written out as rows of '#' and '.'.
const GLYPHS: Record<string, string[]> = {
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
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
};

function charWidth(scale: number): number { return 6 * scale; }
function textWidth(s: string, scale: number): number {
  return s.length * charWidth(scale) - scale;
}

function drawText(x: number, y: number, s: string, scale: number, c: number): number {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS["?"];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "1") fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += charWidth(scale);
  }
  return cx - x - scale;
}

function drawTextCentered(x: number, y: number, w: number, s: string, scale: number, c: number): void {
  const tw = textWidth(s, scale);
  drawText(x + Math.floor((w - tw) / 2), y, s, scale, c);
}

// Greedy word wrap into lines no wider than maxW (pixels).
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur === "" ? w : cur + " " + w;
    if (textWidth(test, scale) <= maxW || cur === "") {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawPara(x: number, y: number, s: string, scale: number, maxW: number, c: number, leading?: number): number {
  const lh = 7 * scale + (leading ?? 3);
  const lines = wrap(s, scale, maxW);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * lh, lines[i], scale, c);
  return y + lines.length * lh;
}

// ------------------------------------------------------------ small icons
function iconVolcano(x: number, y: number, s: number): void {
  // mountain with ash cloud
  triangle(x, y + 34 * s, x + 16 * s, y + 6 * s, x + 32 * s, y + 34 * s, 10);
  triangle(x + 12 * s, y + 12 * s, x + 16 * s, y + 6 * s, x + 20 * s, y + 12 * s, 6);
  circle(x + 16 * s, y + 2 * s, 4 * s, 4, true);
  circle(x + 10 * s, y + 0, 3 * s, 4, true);
  circle(x + 22 * s, y + 0, 3 * s, 4, true);
  line(x + 4 * s, y + 26 * s, x + 10 * s, y + 34 * s, 6);
  line(x + 28 * s, y + 26 * s, x + 22 * s, y + 34 * s, 6);
}

function iconVirus(x: number, y: number, s: number): void {
  circle(x + 16 * s, y + 16 * s, 12 * s, 2, true);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    const x1 = x + 16 * s + Math.round(Math.cos(ang) * 12 * s);
    const y1 = y + 16 * s + Math.round(Math.sin(ang) * 12 * s);
    const x2 = x + 16 * s + Math.round(Math.cos(ang) * 17 * s);
    const y2 = y + 16 * s + Math.round(Math.sin(ang) * 17 * s);
    line(x1, y1, x2, y2, 2);
    circle(x2, y2, 2 * s, 2, true);
  }
  circle(x + 16 * s, y + 16 * s, 5 * s, 11, true);
}

function iconJet(x: number, y: number, s: number): void {
  triangle(x, y + 14 * s, x + 30 * s, y + 16 * s, x, y + 20 * s, 3);
  triangle(x + 8 * s, y + 10 * s, x + 14 * s, y + 16 * s, x + 8 * s, y + 20 * s, 3);
  triangle(x + 20 * s, y + 8 * s, x + 26 * s, y + 16 * s, x + 20 * s, y + 24 * s, 3);
  circle(x + 2 * s, y + 16 * s, 2 * s, 6, true);
}

function iconDrone(x: number, y: number, s: number): void {
  fillRect(x + 8 * s, y + 12 * s, 16 * s, 8 * s, 10);
  circle(x + 4 * s, y + 10 * s, 4 * s, 1, false);
  circle(x + 28 * s, y + 10 * s, 4 * s, 1, false);
  circle(x + 4 * s, y + 22 * s, 4 * s, 1, false);
  circle(x + 28 * s, y + 22 * s, 4 * s, 1, false);
  line(x + 8 * s, y + 12 * s, x + 4 * s, y + 10 * s, 1);
  line(x + 24 * s, y + 12 * s, x + 28 * s, y + 10 * s, 1);
  line(x + 8 * s, y + 20 * s, x + 4 * s, y + 22 * s, 1);
  line(x + 24 * s, y + 20 * s, x + 28 * s, y + 22 * s, 1);
  circle(x + 16 * s, y + 16 * s, 3 * s, 2, true);
}

function iconStars(x: number, y: number, s: number): void {
  circle(x + 16 * s, y + 16 * s, 14 * s, 3, false);
  for (let a = 0; a < 12; a++) {
    const ang = (a * Math.PI) / 6 - Math.PI / 2;
    const px = x + 16 * s + Math.round(Math.cos(ang) * 10 * s);
    const py = y + 16 * s + Math.round(Math.sin(ang) * 10 * s);
    fillRect(px - s, py - s, 2 * s, 2 * s, 8);
  }
}

function iconBalloon(x: number, y: number, s: number): void {
  circle(x + 16 * s, y + 12 * s, 11 * s, 6, true);
  circle(x + 16 * s, y + 12 * s, 11 * s, 1, false);
  triangle(x + 13 * s, y + 22 * s, x + 19 * s, y + 22 * s, x + 16 * s, y + 28 * s, 6);
  line(x + 16 * s, y + 28 * s, x + 16 * s, y + 34 * s, 1);
  fillRect(x + 6 * s, y + 8 * s, 4 * s, 3 * s, 11);
}

function iconTrain(x: number, y: number, s: number): void {
  fillRect(x + 4 * s, y + 4 * s, 24 * s, 22 * s, 2);
  fillRect(x + 8 * s, y + 8 * s, 7 * s, 6 * s, 9);
  fillRect(x + 17 * s, y + 8 * s, 7 * s, 6 * s, 9);
  fillRect(x + 8 * s, y + 18 * s, 16 * s, 3 * s, 11);
  circle(x + 10 * s, y + 28 * s, 3 * s, 1, true);
  circle(x + 22 * s, y + 28 * s, 3 * s, 1, true);
  hline(x, y + 32 * s, 32 * s, 1, 2);
}

function iconBallot(x: number, y: number, s: number): void {
  fillRect(x + 4 * s, y + 12 * s, 24 * s, 20 * s, 3);
  fillRect(x + 8 * s, y + 4 * s, 16 * s, 8 * s, 3);
  fillRect(x + 14 * s, y + 6 * s, 4 * s, 3 * s, 0);
  line(x + 10 * s, y + 20 * s, x + 14 * s, y + 26 * s, 11);
  line(x + 14 * s, y + 26 * s, x + 24 * s, y + 14 * s, 11);
}

function iconChess(x: number, y: number, s: number): void {
  const cell = 4 * s;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      const col = (r + c) % 2 === 0 ? 1 : 11;
      fillRect(x + c * cell, y + r * cell, cell, cell, col);
    }
  // king piece
  circle(x + 2 * cell, y + 2 * cell, 3 * s, 8, true);
  fillRect(x + 2 * cell - s, y + 2 * cell - 5 * s, 2 * s, 5 * s, 8);
}

function iconFlame(x: number, y: number, s: number): void {
  triangle(x + 6 * s, y + 30 * s, x + 16 * s, y + 4 * s, x + 26 * s, y + 30 * s, 6);
  triangle(x + 10 * s, y + 30 * s, x + 16 * s, y + 16 * s, x + 22 * s, y + 30 * s, 8);
  triangle(x + 13 * s, y + 30 * s, x + 16 * s, y + 22 * s, x + 19 * s, y + 30 * s, 2);
}

function iconGavel(x: number, y: number, s: number): void {
  fillRect(x + 4 * s, y + 6 * s, 14 * s, 6 * s, 10);
  line(x + 11 * s, y + 12 * s, x + 24 * s, y + 26 * s, 10);
  fillRect(x + 20 * s, y + 26 * s, 12 * s, 4 * s, 10);
  fillRect(x + 2 * s, y + 30 * s, 28 * s, 3 * s, 1);
}

function iconMissile(x: number, y: number, s: number): void {
  // upright missile with flame, in a bordered box drawn by caller
  const cx = x + 40 * s;
  triangle(cx - 6 * s, y + 8 * s, cx, y, cx + 6 * s, y + 8 * s, 2);
  fillRect(cx - 6 * s, y + 8 * s, 12 * s, 34 * s, 1);
  fillRect(cx - 6 * s, y + 8 * s, 12 * s, 6 * s, 11);
  triangle(cx - 12 * s, y + 42 * s, cx - 6 * s, y + 30 * s, cx - 6 * s, y + 42 * s, 1);
  triangle(cx + 6 * s, y + 30 * s, cx + 12 * s, y + 42 * s, cx + 6 * s, y + 42 * s, 1);
  triangle(cx - 5 * s, y + 42 * s, cx, y + 58 * s, cx + 5 * s, y + 42 * s, 6);
  triangle(cx - 2 * s, y + 42 * s, cx, y + 50 * s, cx + 2 * s, y + 42 * s, 8);
  // stars around
  fillRect(x + 4 * s, y + 6 * s, 3 * s, 3 * s, 8);
  fillRect(x + 70 * s, y + 20 * s, 3 * s, 3 * s, 8);
  fillRect(x + 62 * s, y + 52 * s, 3 * s, 3 * s, 8);
}

// ------------------------------------------------------------------ layout
const MX = 28; // page margin
const PW = W - 2 * MX;

function kicker(x: number, y: number, s: string, c: number): void {
  drawText(x, y, s, 2, c);
}

function panel(x: number, y: number, w: number, h: number, tag: string, tagColor: number,
  head: string, body: string, icon?: (x: number, y: number, s: number) => void): void {
  fillRect(x, y, w, h, 11);
  // top rule + tag
  fillRect(x, y, w, 3, 1);
  drawText(x + 10, y + 12, tag, 2, tagColor);
  hline(x + 10, y + 30, w - 20, 5, 1);
  const tx = x + 10;
  const tw = w - 20;
  let cy = y + 40;
  if (icon) {
    const iw = 44, ih = 44;
    icon(tx, cy, 1);
    // headline beside icon
    const hx = tx + iw + 8;
    cy = drawPara(hx, cy + 2, head, 2, tw - iw - 8, 1, 2);
    cy = Math.max(cy, y + 40 + ih + 6);
  } else {
    cy = drawPara(tx, cy, head, 2, tw, 1, 2);
  }
  drawPara(tx, cy + 4, body, 2, tw, 10, 2);
}

// ------------------------------------------------------------------- page
function drawPage(): void {
  fillRect(0, 0, W, H, 0);
  // thin double border
  fillRect(10, 10, W - 20, 2, 1);
  fillRect(10, H - 12, W - 20, 2, 1);
  fillRect(10, 10, 2, H - 20, 1);
  fillRect(W - 12, 10, 2, H - 20, 1);

  // ---- masthead
  drawTextCentered(MX, 30, PW, "THE WORLD IN ONE DAY", 6, 1);
  hline(MX, 78, PW, 1, 3);
  hline(MX, 84, PW, 1, 1);
  drawTextCentered(MX, 96, PW, "FRIDAY 27 NOVEMBER 2026", 5, 2);
  hline(MX, 138, PW, 1, 1);
  drawTextCentered(MX, 146, PW, "TWELVE STORIES FROM AROUND THE GLOBE - ONE DAY", 2, 10);

  // ---- lead story
  const LY = 172, LH = 228;
  fillRect(MX, LY, PW, LH, 11);
  fillRect(MX, LY, PW, 3, 2);
  drawText(MX + 16, LY + 16, "LEAD STORY - NORTH KOREA", 2, 2);
  hline(MX + 16, LY + 36, PW - 32, 5, 1);
  const headW = 600;
  let y = drawPara(MX + 16, LY + 48, "KIM VOWS TO EXPAND NUCLEAR ARSENAL", 4, headW, 1, 4);
  y = drawPara(MX + 16, y + 8,
    "Kim Jong Un tours nuclear plants and orders more warheads and wider deployment of tactical nuclear weapons, calling the North's nuclear status inviolable.",
    2, headW, 10, 3);
  // missile art on the right
  const artX = MX + PW - 300, artY = LY + 40;
  fillRect(artX, artY, 284, 150, 5);
  fillRect(artX, artY, 284, 3, 1);
  iconMissile(artX + 96, artY + 6, 2);
  drawTextCentered(artX, artY + 130, 284, "MORE WARHEADS", 2, 1);
  // footer line of lead
  hline(MX + 16, LY + LH - 26, PW - 32, 5, 1);
  drawText(MX + 16, LY + LH - 18, "PYONGYANG - THE TOUR PUTS THE NUCLEAR PROGRAMME AT THE CENTRE OF THE DAY", 2, 10);

  // ---- panel grid: 3 columns x 3 rows
  const GY = LY + LH + 14;
  const gap = 12;
  const cw = Math.floor((PW - 2 * gap) / 3);
  const ch = 160;
  const rows: Array<Array<Parameters<typeof panel>>> = [
    [
      [MX, GY, cw, ch, "PHILIPPINES", 6, "MAYON ERUPTS", "Mount Mayon erupts, sending an ash cloud 3,000 metres up. Warnings of larger eruptions to come.", iconVolcano],
      [MX + cw + gap, GY, cw, ch, "DR CONGO", 2, "EBOLA PASSES 12,000 CASES", "Outbreak passes 12,000 confirmed cases and nearly 6,000 deaths. Fighting in Ituri forces aid workers out.", iconVirus],
      [MX + 2 * (cw + gap), GY, cw, ch, "UKRAINE", 3, "STRIKE ON RUSSIAN AIR BASE", "Ukraine says it hit Savasleyka air base east of Moscow, damaging three MiG-31s and two Su-34s.", iconJet],
    ],
    [
      [MX, GY + ch + gap, cw, ch, "KUWAIT", 2, "TWO ITALIANS KILLED IN DRONE ATTACK", "Two Italians killed in an Iranian drone attack in Kuwait. Iran denies responsibility.", iconDrone],
      [MX + cw + gap, GY + ch + gap, cw, ch, "BRUSSELS", 3, "EU LEADERS MEET ON 1.7 TRILLION BUDGET", "Leaders meet over the long-term budget and funding for Ukraine.", iconStars],
      [MX + 2 * (cw + gap), GY + ch + gap, cw, ch, "UNITED STATES", 6, "MACY'S PARADE POSTPONED", "Thanksgiving parade postponed for the first time in 100 years as winter storms delay 6,000+ flights.", iconBalloon],
    ],
    [
      [MX, GY + 2 * (ch + gap), cw, ch, "LONDON", 2, "TUBE DRIVERS BEGIN 8-DAY STRIKE", "Drivers begin eight consecutive days of winter strikes on the Underground.", iconTrain],
      [MX + cw + gap, GY + 2 * (ch + gap), cw, ch, "NEW ZEALAND", 7, "FINAL COUNT DUE TODAY", "Final election count due later Friday. The ruling coalition falls one seat short of a majority.", iconBallot],
      [MX + 2 * (cw + gap), GY + 2 * (ch + gap), cw, ch, "CHESS", 1, "GUKESH AND SINDAROV DRAW GAME 3", "The World Chess Championship rivals draw a marathon Game 3.", iconChess],
    ],
  ];
  for (const row of rows) for (const p of row) panel(...p);

  // ---- bottom strip: two short items
  const BY = GY + 3 * (ch + gap) + 4;
  const BH = 54;
  fillRect(MX, BY, PW, BH, 11);
  fillRect(MX, BY, PW, 3, 1);
  drawText(MX + 12, BY + 12, "BANGKOK:", 2, 6);
  drawText(MX + 12 + textWidth("BANGKOK: ", 2), BY + 12,
    "PATTHAVIKORN MARKET FIRE IN THE EARLY HOURS, OUT BY 6:27 AM.", 2, 1);
  drawText(MX + 12, BY + 34, "THE HAGUE:", 2, 3);
  drawText(MX + 12 + textWidth("THE HAGUE: ", 2), BY + 34,
    "DUTERTE'S ICC TRIAL SET TO START ON MONDAY.", 2, 1);

  // ---- footer
  drawTextCentered(MX, H - 34, PW, "THE WORLD IN ONE DAY - FRIDAY 27 NOVEMBER 2026", 2, 10);
}

// ------------------------------------------------------------- CRC + Adler
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

// ------------------------------------------------------- DEFLATE (fixed Huffman)
const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

class BitWriter {
  bytes: number[] = [];
  cur = 0;
  nbits = 0;
  write(value: number, count: number): void {
    for (let i = 0; i < count; i++) {
      if (value & (1 << i)) this.cur |= 1 << this.nbits;
      this.nbits++;
      if (this.nbits === 8) { this.bytes.push(this.cur); this.cur = 0; this.nbits = 0; }
    }
  }
  // fixed Huffman literal/length code, written LSB-first (codes are
  // stored reversed, so callers pass them through reverseBits)
  flush(): void {
    if (this.nbits > 0) { this.bytes.push(this.cur); this.cur = 0; this.nbits = 0; }
  }
}
// NOTE: fixed Huffman codes in DEFLATE are written with bits reversed
// relative to the canonical code. The writeLit above writes the code
// value's low bits first, which is wrong for multi-bit codes. We fix it
// by reversing each code before writing.
function reverseBits(v: number, n: number): number {
  let r = 0;
  for (let i = 0; i < n; i++) { r = (r << 1) | ((v >> i) & 1); }
  return r;
}

function deflateFixed(data: Uint8Array): Uint8Array {
  const bw = new BitWriter();
  // single final block, fixed Huffman
  bw.write(1, 1); // BFINAL
  bw.write(1, 2); // BTYPE 01

  const lit = (sym: number): void => {
    if (sym < 144) bw.write(reverseBits(0x30 + sym, 8), 8);
    else if (sym < 256) bw.write(reverseBits(0x190 + (sym - 144), 9), 9);
    else if (sym < 280) bw.write(reverseBits(sym - 256, 7), 7);
    else bw.write(reverseBits(0xc0 + (sym - 280), 8), 8);
  };

  // LZ77 with a 3-byte hash table and short chains.
  const HASH_BITS = 15;
  const head = new Int32Array(1 << HASH_BITS).fill(-1);
  const prev = new Int32Array(data.length).fill(-1);
  const hash = (p: number): number =>
    (((data[p] << 10) ^ (data[p + 1] << 5) ^ data[p + 2]) & ((1 << HASH_BITS) - 1));

  let pos = 0;
  const n = data.length;
  while (pos < n) {
    let bestLen = 0, bestDist = 0;
    if (pos + 3 <= n) {
      const h = hash(pos);
      let cand = head[h];
      let tries = 0;
      while (cand >= 0 && tries < 64) {
        const dist = pos - cand;
        if (dist > 32768) break;
        let len = 0;
        while (len < 258 && pos + len < n && data[cand + len] === data[pos + len]) len++;
        if (len >= 3 && len > bestLen) { bestLen = len; bestDist = dist; if (len === 258) break; }
        cand = prev[cand];
        tries++;
      }
      prev[pos] = head[h];
      head[h] = pos;
    }
    if (bestLen >= 3) {
      // find length symbol
      let li = 0;
      while (li < LEN_BASE.length - 1 && LEN_BASE[li + 1] <= bestLen) li++;
      if (bestLen === 258) li = LEN_BASE.length - 1;
      lit(257 + li);
      const extra = bestLen - LEN_BASE[li];
      if (LEN_EXTRA[li] > 0) bw.write(extra, LEN_EXTRA[li]);
      let di = 0;
      while (di < DIST_BASE.length - 1 && DIST_BASE[di + 1] <= bestDist) di++;
      bw.write(reverseBits(di, 5), 5);
      const dextra = bestDist - DIST_BASE[di];
      if (DIST_EXTRA[di] > 0) bw.write(dextra, DIST_EXTRA[di]);
      // insert intermediate positions into the hash table
      for (let k = 1; k < bestLen; k++) {
        const p = pos + k;
        if (p + 3 <= n) {
          const hh = hash(p);
          prev[p] = head[hh];
          head[hh] = p;
        }
      }
      pos += bestLen;
    } else {
      lit(data[pos]);
      pos++;
    }
  }
  lit(256); // end of block
  bw.flush();
  return new Uint8Array(bw.bytes);
}

// ------------------------------------------------------------------- PNG
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePNG(): Uint8Array {
  const raw = new Uint8Array(H * (W + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W + 1)] = 0; // filter: none
    raw.set(buf.subarray(y * W, (y + 1) * W), y * (W + 1) + 1);
  }
  const comp = deflateFixed(raw);
  const zlib = new Uint8Array(comp.length + 6);
  zlib[0] = 0x78; zlib[1] = 0x9c;
  zlib.set(comp, 2);
  const ad = adler32(raw);
  zlib[zlib.length - 4] = (ad >>> 24) & 0xff;
  zlib[zlib.length - 3] = (ad >>> 16) & 0xff;
  zlib[zlib.length - 2] = (ad >>> 8) & 0xff;
  zlib[zlib.length - 1] = ad & 0xff;

  const ihdr = new Uint8Array(13);
  const iv = new DataView(ihdr.buffer);
  iv.setUint32(0, W);
  iv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // color type: palette
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const plte = new Uint8Array(PALETTE.length * 3);
  PALETTE.forEach(([r, g, b], i) => { plte[i * 3] = r; plte[i * 3 + 1] = g; plte[i * 3 + 2] = b; });

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("PLTE", plte), chunk("IDAT", zlib), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ------------------------------------------------------------------ main
function main(): void {
  drawPage();
  const png = encodePNG();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
