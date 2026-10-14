import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const BG        = [14, 10, 24];
const GOLD_HI   = [247, 231, 188];
const GOLD_LO   = [176, 132, 62];
const GOLD_ACC  = [238, 206, 123];
const VIOLET    = [168, 110, 220];
const PINK      = [210, 60, 150];
const BLUE      = [100, 150, 230];

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const tb = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function starVertices(cx, cy, R, r, points = 5) {
  const v = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? R : r;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    v.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return v;
}

function pointInPoly(x, y, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i];
    const [xj, yj] = verts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function renderIcon(size, starR, discR) {
  const S = 4;
  const cx = size / 2;
  const cy = size / 2;
  const verts = starVertices(cx, cy, starR, starR * 0.42);

  const aurora = [
    { x: 0.32, y: 0.30, R: 0.55, c: GOLD_ACC, s: 0.16 },
    { x: 0.78, y: 0.22, R: 0.50, c: VIOLET,   s: 0.13 },
    { x: 0.82, y: 0.84, R: 0.45, c: PINK,     s: 0.09 },
    { x: 0.16, y: 0.86, R: 0.45, c: BLUE,     s: 0.07 },
  ];
  const sparkles = [
    { x: 0.36, y: -0.33, r: 0.022 },
    { x: -0.37, y: 0.10, r: 0.016 },
    { x: 0.13, y: 0.40, r: 0.012 },
  ];
  const ringW = 0.012;

  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0, gSum = 0, bSum = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const fx = x + (sx + 0.5) / S;
          const fy = y + (sy + 0.5) / S;
          const nx = fx / size;
          const ny = fy / size;

          let col = [BG[0], BG[1], BG[2]];

          for (const a of aurora) {
            const d = Math.hypot(nx - a.x, ny - a.y) / a.R;
            if (d < 1) {
              const f = (1 - d) * (1 - d) * a.s;
              col[0] += a.c[0] * f;
              col[1] += a.c[1] * f;
              col[2] += a.c[2] * f;
            }
          }

          const gd = Math.hypot(fx - cx, fy - cy) / size;
          const gR = starR / size / 0.6 + 0.12;
          const gG = Math.max(0, 1 - gd / gR);
          const glow = gG * gG * 0.18;
          col[0] += GOLD_ACC[0] * glow;
          col[1] += GOLD_ACC[1] * glow;
          col[2] += GOLD_ACC[2] * glow;

          const dDisc = Math.hypot(fx - cx, fy - cy) / size;
          if (dDisc < discR) {
            const lift = (1 - dDisc / discR) * 0.12;
            col = col.map((v, i) => v * (1 - lift) + 255 * lift);
            const sheen = Math.max(0, 1 - fy / size / 0.55) * 0.05;
            col[0] += 255 * sheen;
            col[1] += 255 * sheen;
            col[2] += 255 * sheen;
          }

          const ringT = Math.abs(dDisc - discR) / ringW;
          if (ringT <= 1) {
            const a = (1 - ringT) * 0.35;
            col = col.map((v, i) => v * (1 - a) + GOLD_ACC[i] * a);
          }

          if (pointInPoly(fx, fy, verts)) {
            const t = Math.min(1, Math.max(0, (fy - (cy - starR)) / (2 * starR)));
            col = GOLD_HI.map((v, i) => v + (GOLD_LO[i] - v) * t);
          }

          for (const sp of sparkles) {
            const sd = Math.hypot(fx - (cx + sp.x * size), fy - (cy + sp.y * size)) / (sp.r * size);
            if (sd < 1) {
              const f = (1 - sd) * 0.85;
              col = col.map((v, i) => v * (1 - f) + [255, 244, 214][i] * f);
            }
          }

          rSum += col[0]; gSum += col[1]; bSum += col[2];
        }
      }
      const i = (y * size + x) * 4;
      const n = S * S;
      px[i]     = clamp255(rSum / n);
      px[i + 1] = clamp255(gSum / n);
      px[i + 2] = clamp255(bSum / n);
      px[i + 3] = 255;
    }
  }
  return encodePNG(size, size, px);
}

const specs = [
  ["icon-192.png",           192, 45, 76],
  ["icon-512.png",           512, 118, 200],
  ["icon-512-maskable.png",  512, 92, 176],
  ["apple-touch-icon.png",   180, 42, 70],
];

mkdirSync(OUT, { recursive: true });
for (const [name, size, starR, discR] of specs) {
  const file = join(OUT, name);
  writeFileSync(file, renderIcon(size, starR, discR));
  console.log(`✓ ${name} (${size}x${size})`);
}
