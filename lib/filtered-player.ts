import {html as parse5Html, parse, serialize, type DefaultTreeAdapterMap} from 'parse5';

const PROVIDER = 'https://superflixapi.fun';
export const MAX_PLAYER_BYTES = 1_500_000;
export const FILTERED_SANDBOX = 'allow-scripts allow-forms allow-presentation';
export const FILTERED_CSP = `sandbox ${FILTERED_SANDBOX}; object-src 'none'; base-uri ${PROVIDER}; form-action ${PROVIDER}`;

// Keep this endpoint restricted to the provider's public player documents.
export function providerUrl(path: string): URL {
  if (path.length > 2048 || !path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Invalid player path');
  }
  const url = new URL(path, PROVIDER);
  if (url.origin !== PROVIDER || url.username || url.password ||
      !/^\/(?:filme|serie|embed|player)\//.test(url.pathname)) {
    throw new Error('Invalid player origin or path');
  }
  url.hash = '';
  return url;
}

export function filteredUrl(url: URL): string {
  return '/api/player/filter?path=' + encodeURIComponent(url.pathname + url.search) + url.hash;
}

const adHosts = ['asiafilm.org', 'budgetezy.org', 'spartanamicus.com', 'linkonclick.com'];
const adCode = /\/sanbox\.php|\bdetectSandbox\b|sf_qads_|\/player\/pop-signal/;
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type Parent = DefaultTreeAdapterMap['parentNode'];

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

function text(node: Node): string {
  if (node.nodeName === '#text') return (node as DefaultTreeAdapterMap['textNode']).value;
  return 'childNodes' in node ? node.childNodes.map(text).join('') : '';
}

function attr(node: Element, name: string): string | undefined {
  return node.attrs.find(a => a.name === name)?.value;
}

function setAttr(node: Element, name: string, value: string) {
  const existing = node.attrs.find(a => a.name === name);
  if (existing) existing.value = value;
  else node.attrs.push({name, value});
}

export function isVerificationPage(html: string): boolean {
  return /confirme que voc[eê] [eé] humano para continuar|sorry, you have been blocked|cf-chl-|<title>\s*(?:verifica[çc][ãa]o|just a moment|attention required)/i.test(html);
}

export function filterPlayerHtml(html: string, upstream: URL, appOrigin: string): string {
  const document = parse(html);
  function clean(parent: Parent) {
    parent.childNodes = parent.childNodes.filter(node => {
      if (!isElement(node)) return true;
      if (['base', 'object', 'embed'].includes(node.tagName)) return false;
      if (node.tagName === 'meta' && ['refresh', 'content-security-policy'].includes((attr(node, 'http-equiv') || '').toLowerCase())) return false;
      if (node.tagName === 'script') {
        if (adCode.test(text(node))) return false;
        try {
          const src = attr(node, 'src');
          const hostname = src ? new URL(src, upstream).hostname : '';
          if (adHosts.some(host => hostname === host || hostname.endsWith('.' + host))) return false;
        } catch { return false; }
      }
      if (node.tagName === 'iframe') {
        const src = attr(node, 'src');
        if (src) {
          try {
            const resolved = new URL(src, upstream);
            if (resolved.origin === PROVIDER) {
              const allowed = providerUrl(resolved.pathname + resolved.search);
              allowed.hash = resolved.hash;
              setAttr(node, 'src', new URL(filteredUrl(allowed), appOrigin).href);
            }
          } catch { /* Other providers remain isolated by the inherited sandbox. */ }
        }
      }
      clean(node);
      if (node.tagName === 'template') clean((node as DefaultTreeAdapterMap['template']).content);
      return true;
    });
  }
  clean(document);
  const htmlNode = document.childNodes.find(node => isElement(node) && node.tagName === 'html') as Element;
  const head = htmlNode.childNodes.find(node => isElement(node) && node.tagName === 'head') as Element;
  head.childNodes.unshift({nodeName:'base', tagName:'base', namespaceURI:parse5Html.NS.HTML, attrs:[{name:'href', value:upstream.href}], childNodes:[], parentNode:head});
  return serialize(document);
}

export async function readPlayerHtml(response: Response): Promise<string> {
  if (!response.body || Number(response.headers.get('content-length') || 0) > MAX_PLAYER_BYTES) {
    throw new Error('Player document too large or empty');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PLAYER_BYTES) {
        await reader.cancel();
        throw new Error('Player document too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
