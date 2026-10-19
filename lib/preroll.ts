export type MediaCandidate={url:string;type:string;width:number;height:number};
export type PrerollAd={video:string;skipAfter:number;offset?:string;impressions:string[];events:Record<string,string[]>};
const DEFAULT_SKIP=5;
export function clampSkip(value?:string|number|null){const n=Number(value);return Number.isFinite(n)&&n>=0?Math.min(30,Math.round(n)):DEFAULT_SKIP;}
// VAST skipoffset: "HH:MM:SS(.mmm)" or "NN%". Without one, the Flix default applies.
export function skipSeconds(offset:string|null|undefined,duration:number,fallback=DEFAULT_SKIP){
 const value=(offset||'').trim();
 const percent=/^(\d{1,3}(?:\.\d+)?)%$/.exec(value);if(percent&&duration>0)return Math.min(duration,duration*Number(percent[1])/100);
 const time=/^(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value);if(time)return Number(time[1])*3600+Number(time[2])*60+Number(time[3]);
 return fallback;
}
// Prefer progressive MP4 near phone width; the browser cannot play VPAID or most streaming types here.
export function pickMedia(files:MediaCandidate[],target=854){
 const playable=files.filter(f=>/^https:\/\//.test(f.url)&&/^video\/(mp4|webm)$/i.test(f.type));
 return playable.sort((a,b)=>Math.abs((a.width||target)-target)-Math.abs((b.width||target)-target)||(/mp4/i.test(a.type)?-1:1))[0]?.url||'';
}
export function expandMacros(url:string){return url.replace(/\[(CACHEBUSTING|TIMESTAMP)\]|%%CACHEBUSTER%%/g,()=>String(Math.floor(Math.random()*1e10)));}
export function trackingUrls(urls:string[]){return urls.map(u=>u.trim()).filter(u=>/^https?:\/\//.test(u)).map(expandMacros);}
