import fs from 'node:fs';

/**
 * Read movie duration from an ISO BMFF / MP4 mvhd box. Returns null if the file
 * is not a readable mp4 or mvhd is missing.
 */
export function readMp4DurationMs(filePath: string): number | null {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    const size = fs.fstatSync(fd).size;
    const seconds = findMvhdDurationSeconds(fd, 0, size);
    if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
    return Math.max(1, Math.ceil(seconds * 1000));
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function findMvhdDurationSeconds(fd: number, start: number, end: number): number | null {
  let offset = start;
  while (offset + 8 <= end) {
    const header = Buffer.alloc(16);
    const n = fs.readSync(fd, header, 0, 16, offset);
    if (n < 8) return null;
    let size = header.readUInt32BE(0);
    const type = header.toString('ascii', 4, 8);
    let headerSize = 8;
    if (size === 1) {
      if (n < 16) return null;
      size = Number(header.readBigUInt64BE(8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (!Number.isFinite(size) || size < headerSize) return null;
    const next = offset + size;
    if (next > end + 1) return null;

    if (type === 'moov' || type === 'trak' || type === 'mdia') {
      const nested = findMvhdDurationSeconds(fd, offset + headerSize, next);
      if (nested != null) return nested;
    } else if (type === 'mvhd') {
      return parseMvhd(fd, offset + headerSize, next);
    }

    if (next <= offset) return null;
    offset = next;
  }
  return null;
}

function parseMvhd(fd: number, start: number, end: number): number | null {
  const need = Math.min(32, Math.max(0, end - start));
  if (need < 20) return null;
  const buf = Buffer.alloc(need);
  const n = fs.readSync(fd, buf, 0, need, start);
  if (n < 20) return null;
  const version = buf[0];
  if (version === 1) {
    if (n < 32) return null;
    const timescale = buf.readUInt32BE(20);
    const duration = Number(buf.readBigUInt64BE(24));
    if (!timescale) return null;
    return duration / timescale;
  }
  const timescale = buf.readUInt32BE(12);
  const duration = buf.readUInt32BE(16);
  if (!timescale) return null;
  return duration / timescale;
}
