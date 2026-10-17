import {normalizeTitle, titleKey} from './catalog.ts';
import type {Title} from './catalog.ts';
export type WatchEntry = {title:Title; season:number; episode:number; position:number; duration:number; updatedAt:number; completed:boolean};
export type WatchLibrary = {favorites:Title[]; history:WatchEntry[]};
export const STORAGE_KEY='flix:library:v1';
export const EMPTY_LIBRARY:WatchLibrary={favorites:[],history:[]};
let memory:WatchLibrary=EMPTY_LIBRARY;
let cachedRaw:string|null|undefined;
const positive=(n:any, fallback=1)=>Number.isInteger(n)&&n>=1&&n<=10000?n:fallback;
const seconds=(n:any)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=604800?n:0;
export function parseLibrary(raw:string|null):WatchLibrary {
  try {
    const data=JSON.parse(raw||'{}');
    const seen=new Set<string>();
    const favorites=(Array.isArray(data?.favorites)?data.favorites:[]).map((v:any)=>normalizeTitle(v)).filter((t:Title|null):t is Title=>!!t).filter((t:Title)=>{const k=titleKey(t);if(seen.has(k))return false;seen.add(k);return true}).slice(0,200);
    seen.clear();
    const history=(Array.isArray(data?.history)?data.history:[]).flatMap((v:any)=>{
      const title=normalizeTitle(v?.title);if(!title||seen.has(titleKey(title)))return [];
      seen.add(titleKey(title));const duration=seconds(v.duration);const position=Math.min(seconds(v.position),duration||604800);
      return [{title,season:positive(v.season),episode:positive(v.episode),position,duration,updatedAt:typeof v.updatedAt==='number'&&Number.isFinite(v.updatedAt)&&v.updatedAt>0?Math.min(v.updatedAt,Date.now()):0,completed:duration>0&&position/duration>=.95}];
    }).sort((a:WatchEntry,b:WatchEntry)=>b.updatedAt-a.updatedAt).slice(0,80);
    return {favorites,history};
  } catch {return {favorites:[],history:[]};}
}
export function readLibrary():WatchLibrary {
  if(typeof window==='undefined')return EMPTY_LIBRARY;
  try {const raw=localStorage.getItem(STORAGE_KEY);if(raw!==cachedRaw){memory=parseLibrary(raw);cachedRaw=raw;}}catch{}
  return memory;
}
function save(library:WatchLibrary) {
  memory=library;
  try {const raw=JSON.stringify(library);localStorage.setItem(STORAGE_KEY,raw);cachedRaw=raw;}catch{}
  if(typeof window!=='undefined')window.dispatchEvent(new Event('flix:library'));
}
export function toggleFavorite(title:Title) {
  const data=readLibrary(),key=titleKey(title);
  save({...data,favorites:data.favorites.some(t=>titleKey(t)===key)?data.favorites.filter(t=>titleKey(t)!==key):[title,...data.favorites].slice(0,200)});
}
export function startWatching(title:Title,season=1,episode=1) {
  const data=readLibrary(),key=titleKey(title),old=data.history.find(h=>titleKey(h.title)===key);
  const same=old?.season===season&&old?.episode===episode;
  const entry:WatchEntry={title,season:positive(season),episode:positive(episode),position:same&&!old?.completed?old.position:0,duration:same?old?.duration||0:0,updatedAt:Date.now(),completed:false};
  save({...data,history:[entry,...data.history.filter(h=>titleKey(h.title)!==key)].slice(0,80)});
  return entry;
}
export function applyProgress(data:WatchLibrary,key:string,season:number,episode:number,position:number,duration:number):WatchLibrary {
  if(!Number.isFinite(position)||!Number.isFinite(duration)||position<0||duration<=0||duration>604800)return data;
  const old=data.history.find(h=>titleKey(h.title)===key);
  if(!old||old.season!==season||old.episode!==episode)return data;
  const entry={...old,position:Math.min(position,duration),duration,updatedAt:Date.now(),completed:position/duration>=.95};
  return {...data,history:[entry,...data.history.filter(h=>titleKey(h.title)!==key)]};
}
export function recordProgress(key:string,season:number,episode:number,position:number,duration:number) {
  const before=readLibrary(),after=applyProgress(before,key,season,episode,position,duration);
  if(after!==before)save(after);
}
export function removeHistory(key:string) {const data=readLibrary();save({...data,history:data.history.filter(h=>titleKey(h.title)!==key)});}
export function timeLabel(seconds:number) {const mins=Math.floor(Math.max(0,seconds)/60);return mins>=60?`${Math.floor(mins/60)}h ${mins%60}min`:`${mins}min`;}
