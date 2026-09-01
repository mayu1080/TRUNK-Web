import fs from 'node:fs';

export interface ImagePixelSize {
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp' | 'gif';
}

function readHeader(filePath: string, length: number): Buffer | null {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(length);
    const n = fs.readSync(fd, buf, 0, length, 0);
    return n > 0 ? buf.subarray(0, n) : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function pngSize(buf: Buffer): ImagePixelSize | null {
  if (buf.length < 24) return null;
  if (buf.toString('ascii', 1, 4) !== 'PNG') return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    format: 'png',
  };
}

function gifSize(buf: Buffer): ImagePixelSize | null {
  if (buf.length < 10) return null;
  const sig = buf.toString('ascii', 0, 6);
  if (sig !== 'GIF87a' && sig !== 'GIF89a') return null;
  return {
    width: buf.readUInt16LE(6),
    height: buf.readUInt16LE(8),
    format: 'gif',
  };
}

function webpSize(buf: Buffer): ImagePixelSize | null {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X' && buf.length >= 30) {
    const w = 1 + buf.readUIntLE(24, 3);
    const h = 1 + buf.readUIntLE(27, 3);
    return { width: w, height: h, format: 'webp' };
  }
  if (kind === 'VP8L' && buf.length >= 25) {
    const bits = buf.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      format: 'webp',
    };
  }
  if (kind === 'VP8 ' && buf.length >= 30) {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
      format: 'webp',
    };
  }
  return null;
}

function jpegSize(filePath: string): ImagePixelSize | null {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    const stat = fs.fstatSync(fd);
    let offset = 2;
    const marker = Buffer.alloc(4);
    const start = Buffer.alloc(2);
    if (fs.readSync(fd, start, 0, 2, 0) < 2 || start[0] !== 0xff || start[1] !== 0xd8) return null;
    while (offset + 4 <= stat.size) {
      if (fs.readSync(fd, marker, 0, 4, offset) < 4) return null;
      if (marker[0] !== 0xff) return null;
      const code = marker[1]!;
      const len = marker.readUInt16BE(2);
      if (code === 0xc0 || code === 0xc1 || code === 0xc2) {
        const sof = Buffer.alloc(7);
        if (fs.readSync(fd, sof, 0, 7, offset + 4) < 7) return null;
        return {
          height: sof.readUInt16BE(1),
          width: sof.readUInt16BE(3),
          format: 'jpeg',
        };
      }
      if (len < 2) return null;
      offset += 2 + len;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function readImagePixelSize(filePath: string): ImagePixelSize | null {
  const buf = readHeader(filePath, 32);
  if (!buf || buf.length < 8) return null;
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return pngSize(buf);
  if (buf.toString('ascii', 0, 3) === 'GIF') return gifSize(buf);
  if (buf.toString('ascii', 0, 4) === 'RIFF') return webpSize(buf);
  if (buf[0] === 0xff && buf[1] === 0xd8) return jpegSize(filePath);
  return null;
}
