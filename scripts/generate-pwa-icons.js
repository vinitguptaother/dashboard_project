#!/usr/bin/env node
/**
 * generate-pwa-icons.js — Phase 6 MVP PWA icon generator.
 *
 * Produces two tiny PNG icons (192x192 and 512x512) with a simple "₹" glyph
 * on the project brand color. Avoids the `sharp` / Canvas dependency by
 * writing the PNG bytes ourselves using zlib (all that Node already ships).
 *
 * Output: public/icon-192.png, public/icon-512.png
 *
 * Run with: node scripts/generate-pwa-icons.js
 *
 * If the user later drops in their own branded icons at the same paths,
 * this script doesn't need to run again — the manifest just picks them up.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Brand palette from manifest.json
const BG = [30, 64, 175];        // #1e40af  (indigo-800)
const FG = [248, 250, 252];      // #f8fafc  (slate-50)

function hash32(n) {
  // Kept separate so we can compute CRC32 without pulling in a lib.
  return n >>> 0;
}

function crc32(buf) {
  let c;
  const table = crc32._table || (crc32._table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return hash32(c ^ 0xffffffff);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * A micro 7×11 bitmap of the rupee symbol (₹).
 * 1 = foreground pixel, 0 = background.
 * Chosen to be readable at 192 and 512 when scaled.
 */
const GLYPH_W = 7;
const GLYPH_H = 11;
const GLYPH = [
  '0111110',
  '1000001',
  '1000000',
  '1111110',
  '1000001',
  '1111110',
  '0000010',
  '0001100',
  '0011000',
  '0110000',
  '1100000',
];

function pixelIsFG(size, x, y) {
  // Background circle + center glyph.
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.48;
  const dx = x - cx;
  const dy = y - cy;
  const insideCircle = dx * dx + dy * dy <= r * r;
  if (!insideCircle) return null; // transparent-ish — we'll fill with BG anyway for simplicity

  // Scale glyph to ~55% of icon height, center it.
  const scale = Math.floor((size * 0.55) / GLYPH_H);
  const gw = GLYPH_W * scale;
  const gh = GLYPH_H * scale;
  const gx0 = Math.floor((size - gw) / 2);
  const gy0 = Math.floor((size - gh) / 2);
  if (x < gx0 || y < gy0 || x >= gx0 + gw || y >= gy0 + gh) return 'bg';
  const gx = Math.floor((x - gx0) / scale);
  const gy = Math.floor((y - gy0) / scale);
  if (gy < 0 || gy >= GLYPH_H) return 'bg';
  const row = GLYPH[gy];
  return row[gx] === '1' ? 'fg' : 'bg';
}

function makeImage(size) {
  const rowBytes = size * 3 + 1; // RGB + filter byte per row
  const raw = Buffer.alloc(rowBytes * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0; // filter = None
    for (let x = 0; x < size; x++) {
      const off = y * rowBytes + 1 + x * 3;
      const which = pixelIsFG(size, x, y);
      const c = which === 'fg' ? FG : BG;
      raw[off] = c[0]; raw[off + 1] = c[1]; raw[off + 2] = c[2];
    }
  }
  const idat = zlib.deflateSync(raw);

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type = RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function main() {
  const outDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const sizes = [192, 512];
  for (const size of sizes) {
    const png = makeImage(size);
    const outPath = path.join(outDir, `icon-${size}.png`);
    fs.writeFileSync(outPath, png);
    console.log(`Wrote ${outPath} (${png.length} bytes)`);
  }
  console.log('PWA icons generated.');
}

if (require.main === module) main();

module.exports = { makeImage };
