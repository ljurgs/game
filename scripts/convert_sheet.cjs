#!/usr/bin/env node
// Convert a 2x2 (64x64) sprite sheet of 32px frames into a 1x4 column sheet.
// Original layout (32x32 tiles):
// [0,0]=up, [32,0]=right, [0,32]=left, [32,32]=down
// Output layout rows (top to bottom): down, left, right, up

const fs = require("fs");
const zlib = require("zlib");

const SRC = "public/assets/sprites/sheet_f_hair_1_orig.png";
const OUT = "public/assets/sprites/sheet_f_hair_1.png";

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readChunk(buf, offset) {
  const length = buf.readUInt32BE(offset);
  const type = buf.slice(offset + 4, offset + 8).toString("ascii");
  const data = buf.slice(offset + 8, offset + 8 + length);
  const crc = buf.readUInt32BE(offset + 8 + length);
  return { length, type, data, crc, next: offset + 12 + length };
}

function parsePng(path) {
  const buf = fs.readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error("Not a PNG");
  }
  let offset = 8;
  let width, height, bitDepth, colorType;
  const idatParts = [];
  while (offset < buf.length) {
    const { type, data, next } = readChunk(buf, offset);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === "IDAT") {
      idatParts.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = next;
  }
  const compressed = Buffer.concat(idatParts);
  const raw = zlib.inflateSync(compressed);
  return { width, height, bitDepth, colorType, raw };
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodeRaw({ width, height, raw, bytesPerPixel }) {
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(width * height * bytesPerPixel);
  let srcOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[srcOffset];
    srcOffset += 1;
    for (let x = 0; x < stride; x++) {
      const idx = y * stride + x;
      const left = x >= bytesPerPixel ? out[idx - bytesPerPixel] : 0;
      const up = y > 0 ? out[idx - stride] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? out[idx - stride - bytesPerPixel] : 0;
      const val = raw[srcOffset++];
      let recon;
      switch (filter) {
        case 0: recon = val; break;
        case 1: recon = (val + left) & 0xff; break;
        case 2: recon = (val + up) & 0xff; break;
        case 3: recon = (val + Math.floor((left + up) / 2)) & 0xff; break;
        case 4: recon = (val + paethPredictor(left, up, upLeft)) & 0xff; break;
        default: throw new Error("Unsupported filter " + filter);
      }
      out[idx] = recon;
    }
  }
  return out;
}

function encodePng({ width, height, data }) {
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type 0 (none)
    data.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }
  const compressed = zlib.deflateSync(raw);

  const chunks = [];
  const writeChunk = (type, chunkData) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(chunkData.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, chunkData])), 0);
    chunks.push(len, typeBuf, chunkData, crcBuf);
  };

  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace
  writeChunk("IHDR", ihdr);
  writeChunk("IDAT", compressed);
  writeChunk("IEND", Buffer.alloc(0));
  return Buffer.concat([pngSig, ...chunks]);
}

function copyTile(src, srcW, srcX, srcY, tileSize, dest, destW, destY) {
  const bytesPerPixel = 4;
  for (let y = 0; y < tileSize; y++) {
    const srcRow = (srcY + y) * srcW * bytesPerPixel + srcX * bytesPerPixel;
    const destRow = (destY + y) * destW * bytesPerPixel;
    src.copy(dest, destRow, srcRow, srcRow + tileSize * bytesPerPixel);
  }
}

function main() {
  const srcPng = parsePng(SRC);
  const bytesPerPixel = 4;
  if (srcPng.width !== 64 || srcPng.height !== 64) {
    console.warn(`Expected 64x64 sheet, got ${srcPng.width}x${srcPng.height}; proceeding anyway`);
  }
  if (srcPng.bitDepth !== 8 || srcPng.colorType !== 6) {
    throw new Error("Only supports 8-bit RGBA PNGs");
  }
  const rgba = decodeRaw({ width: srcPng.width, height: srcPng.height, raw: srcPng.raw, bytesPerPixel });
  const tileSize = 32;
  const outW = tileSize;
  const outH = tileSize * 4;
  const outData = Buffer.alloc(outW * outH * bytesPerPixel);
  // Output order: down, left, right, up
  copyTile(rgba, srcPng.width, 32, 32, tileSize, outData, outW, 0 * tileSize); // down
  copyTile(rgba, srcPng.width, 0, 32, tileSize, outData, outW, 1 * tileSize); // left
  copyTile(rgba, srcPng.width, 32, 0, tileSize, outData, outW, 2 * tileSize); // right
  copyTile(rgba, srcPng.width, 0, 0, tileSize, outData, outW, 3 * tileSize); // up

  const pngBuf = encodePng({ width: outW, height: outH, data: outData });
  fs.writeFileSync(OUT, pngBuf);
  console.log(`Wrote ${OUT} (${outW}x${outH})`);
}

if (require.main === module) {
  main();
}
