import { net, protocol } from 'electron';
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

/** Map trunk-content://local/... to contentRoot, trunk-content://logo/... to Logo/. */
export function registerContentProtocolHandler(
  getContentRoot: () => string,
  getLogoRoot?: () => string,
): void {
  let hits = 0;
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
      const response = await net.fetch(pathToFileURL(absolute).href);
      const ext = path.extname(absolute).toLowerCase();
      if (ext === '.otf') {
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'Content-Type': 'font/otf',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[content-protocol] fail url=${request.url} ${message}`);
      return new Response('Not Found', { status: 404 });
    }
  });
}
