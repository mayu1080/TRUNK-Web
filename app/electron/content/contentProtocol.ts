import { net, protocol } from 'electron';
import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveContentPath } from './contentRoot';

export const CONTENT_RENDER_SCHEME = 'trunk-content';

/** Must run before app.whenReady(). */
export function registerContentSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CONTENT_RENDER_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function encodeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function toContentRenderUrl(relativePath: string): string {
  return `${CONTENT_RENDER_SCHEME}://local/${encodeRelativePath(relativePath)}`;
}

/** Repo-root Logo/ files. Renderer never sees an absolute filesystem path. */
export function toLogoRenderUrl(fileName: string): string {
  return `${CONTENT_RENDER_SCHEME}://logo/${encodeRelativePath(fileName)}`;
}

function contentTypeFor(ext: string): string {
  switch (ext) {
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.otf':
      return 'font/otf';
    case '.ttf':
      return 'font/ttf';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

function parseBytesRange(header: string | null, size: number): { start: number; end: number } | 'invalid' | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith('bytes=')) return 'invalid';
  const spec = trimmed.slice(6).split(',')[0]?.trim() ?? '';
  const m = /^(\d*)-(\d*)$/.exec(spec);
  if (!m) return 'invalid';
  const hasStart = m[1] !== '';
  const hasEnd = m[2] !== '';
  if (!hasStart && !hasEnd) return 'invalid';
  if (!hasStart) {
    const suffix = Number(m[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(m[1]);
  const end = hasEnd ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    return 'invalid';
  }
  return { start, end };
}

const MAX_BUFFERED_RANGE = 8 * 1024 * 1024;

function rangeHeaders(type: string, size: number, start: number, end: number): Record<string, string> {
  return {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': String(end - start + 1),
    'Content-Range': `bytes ${start}-${end}/${size}`,
  };
}

async function streamRangeBody(absolute: string, start: number, end: number, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const fh = await open(absolute, 'r');
  let offset = start;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await fh.close();
  };
  signal.addEventListener(
    'abort',
    () => {
      void close();
    },
    { once: true },
  );
  return new ReadableStream({
    async pull(controller) {
      if (offset > end) {
        await close();
        controller.close();
        return;
      }
      const chunkSize = Math.min(256 * 1024, end - offset + 1);
      const buf = new Uint8Array(chunkSize);
      const { bytesRead } = await fh.read(buf, 0, chunkSize, offset);
      if (bytesRead === 0) {
        await close();
        controller.close();
        return;
      }
      offset += bytesRead;
      controller.enqueue(buf.subarray(0, bytesRead));
    },
    cancel() {
      void close();
    },
  });
}

async function rangeResponse(
  absolute: string,
  size: number,
  type: string,
  request: Request,
  range: { start: number; end: number },
): Promise<Response> {
  const { start, end } = range;
  const headers = rangeHeaders(type, size, start, end);
  if (request.method === 'HEAD') {
    return new Response(null, { status: 206, headers });
  }
  const length = end - start + 1;
  if (length <= MAX_BUFFERED_RANGE) {
    const fh = await open(absolute, 'r');
    try {
      const buf = new Uint8Array(length);
      const { bytesRead } = await fh.read(buf, 0, length, start);
      return new Response(buf.subarray(0, bytesRead), { status: 206, headers });
    } finally {
      await fh.close();
    }
  }
  return new Response(await streamRangeBody(absolute, start, end, request.signal), { status: 206, headers });
}

/** Map trunk-content://local/... to contentRoot, trunk-content://logo/... to Logo/. */
export function registerContentProtocolHandler(
  getContentRoot: () => string,
  getLogoRoot?: () => string,
): void {
  let hits = 0;
  let rangeHits = 0;
  protocol.handle(CONTENT_RENDER_SCHEME, async (request) => {
    try {
      hits += 1;
      const parsed = new URL(request.url);
      const relativePath = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
      const useLogo = parsed.hostname === 'logo';
      const root = useLogo ? getLogoRoot?.() : getContentRoot();
      if (!root) {
        throw new Error(useLogo ? 'Logo root is not available' : 'content root is not available');
      }
      const absolute = resolveContentPath(root, relativePath);
      if (hits <= 5) {
        console.info(`[content-protocol] ${request.url} -> ${absolute}`);
      }
      const fileStat = await stat(absolute);
      if (!fileStat.isFile()) {
        return new Response('Not Found', { status: 404 });
      }
      const ext = path.extname(absolute).toLowerCase();
      const type = contentTypeFor(ext);
      const range = parseBytesRange(request.headers.get('range'), fileStat.size);
      if (range === 'invalid') {
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileStat.size}`,
            'Accept-Ranges': 'bytes',
          },
        });
      }
      if (range) {
        rangeHits += 1;
        if (rangeHits <= 12) {
          console.info('[content-protocol] range', {
            relativePath,
            start: range.start,
            end: range.end,
            size: fileStat.size,
          });
        }
        return rangeResponse(absolute, fileStat.size, type, request, range);
      }
      const response = await net.fetch(pathToFileURL(absolute).href, {
        bypassCustomProtocolHandlers: true,
      });
      if (ext === '.otf') {
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'Content-Type': 'font/otf',
            'Access-Control-Allow-Origin': '*',
            'Accept-Ranges': 'bytes',
          },
        });
      }
      const headers = new Headers(response.headers);
      headers.set('Accept-Ranges', 'bytes');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[content-protocol] fail url=${request.url} ${message}`);
      return new Response('Not Found', { status: 404 });
    }
  });
}
