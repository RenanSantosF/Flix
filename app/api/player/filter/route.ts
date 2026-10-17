import {NextRequest} from 'next/server';
import {FILTERED_CSP, filterPlayerHtml, isExternalViewPage, isVerificationPage, providerUrl, readPlayerHtml} from '../../../../lib/filtered-player';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': FILTERED_CSP,
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

function unavailable(status: number, reason: string) {
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Player filtrado</title><body style="margin:0;background:#080b12;color:#fff;font:16px system-ui;display:grid;place-items:center;min-height:100vh"><main style="max-width:520px;padding:24px;text-align:center"><h2>Este modo não conseguiu carregar o player</h2><p>O provedor não liberou o conteúdo para filtragem nesta conexão.</p><p>Você pode selecionar outra opção em <strong>Proteção contra pop-ups</strong>, acima do vídeo.</p></main></body></html>`, {status, headers:{...headers, 'X-Player-Error':reason}});
}

export async function GET(request: NextRequest) {
  let upstream: URL;
  try { upstream = providerUrl(request.nextUrl.searchParams.get('path') || ''); }
  catch { return unavailable(400, 'invalid_source'); }
  const signal = AbortSignal.timeout(12000);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetch(upstream, {
        redirect: 'manual', cache: 'no-store', credentials: 'omit', signal,
        headers: {Accept: 'text/html', Referer: request.nextUrl.origin + '/'},
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects === 3) return unavailable(502, 'redirect_limit');
        const next = new URL(location, upstream);
        // Revalidate every redirect: never forward requests to another host.
        if (next.origin !== upstream.origin) return unavailable(502, 'external_redirect');
        upstream = providerUrl(next.pathname + next.search);
        continue;
      }
      if (!response.ok) {
        const status = response.status;
        await response.body?.cancel();
        return unavailable(502, 'upstream_http_' + status);
      }
      if (!response.headers.get('content-type')?.includes('text/html')) {
        await response.body?.cancel();
        return unavailable(502, 'unsupported_document');
      }
      const html = await readPlayerHtml(response);
      // Do not proxy or attempt to work around the provider's human verification.
      if (isVerificationPage(html)) return unavailable(502, 'verification_required');
      if (isExternalViewPage(html)) return unavailable(502, 'embed_document_unavailable');
      return new Response(filterPlayerHtml(html, upstream, request.nextUrl.origin), {headers});
    }
  } catch { return unavailable(502, signal.aborted ? 'source_timeout' : 'source_request_failed'); }
  return unavailable(502, 'source_unavailable');
}
