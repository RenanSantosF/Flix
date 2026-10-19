export type AdSize='banner'|'rect';
const FORMATS:Record<AdSize,{width:number;height:number}>={banner:{width:320,height:50},rect:{width:300,height:250}};
export function adFormat(size:AdSize){return FORMATS[size];}
// Adsterra banner keys are 32 hex characters; anything else is ignored so env typos cannot inject markup.
export function adKey(value?:string|null){const key=(value||'').trim().toLowerCase();return /^[0-9a-f]{32}$/.test(key)?key:'';}
export function adHost(value?:string|null){const host=(value||'').trim().toLowerCase();return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)?host:'www.highperformanceformat.com';}
export function adDocument(key:string|undefined,size:AdSize,host?:string){
 const id=adKey(key);if(!id)return '';const {width,height}=FORMATS[size];
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body><script>atOptions={key:'${id}',format:'iframe',height:${height},width:${width},params:{}};</script><script src="https://${adHost(host)}/${id}/invoke.js"></script></body></html>`;
}
