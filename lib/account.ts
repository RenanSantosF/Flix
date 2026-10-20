import {parseLibrary} from './watch-library.ts';
import {parseEpisodes} from './episode-progress.ts';
import {titleKey} from './catalog.ts';
import type {WatchLibrary} from './watch-library.ts';
import type {EpisodeMark} from './episode-progress.ts';
// Phone + password accounts without verification: the phone is only an identifier.
export type Episodes=Record<string,Record<string,EpisodeMark>>;
export type SyncDoc={library:WatchLibrary;episodes:Episodes;rev:number};
/** Brazilian mobile/landline with area code, with or without +55; returns the 10-11 national digits. */
export function normalizePhone(raw:unknown):string|null{
 if(typeof raw!=='string'||raw.length>40)return null;
 let digits=raw.replace(/\D/g,'');
 if((digits.length===12||digits.length===13)&&digits.startsWith('55'))digits=digits.slice(2);
 if(digits.length===11&&digits.startsWith('0'))return null;
 if(digits.length===12&&digits.startsWith('0'))digits=digits.slice(1);
 return /^[1-9][1-9]\d{8,9}$/.test(digits)?digits:null;
}
export const validPassword=(value:unknown):value is string=>typeof value==='string'&&value.length>=4&&value.length<=64;
export function formatPhone(digits:string){
 let d=digits.replace(/\D/g,'');if(d.length>11&&d.startsWith('55'))d=d.slice(2);d=d.slice(0,11);
 if(d.length<=2)return d.length?`(${d}`:'';
 const rest=d.slice(2),split=d.length===11?5:4;
 return `(${d.slice(0,2)}) ${rest.slice(0,split)}${rest.length>split?'-'+rest.slice(split):''}`;
}
export const maskPhone=(digits:string)=>`(${digits.slice(0,2)}) •••••-${digits.slice(-4)}`;
/** Union of both sides: favorites keep the newer side's order, history and episodes keep the latest mark. */
export function mergeLibrary(older:WatchLibrary,newer:WatchLibrary):WatchLibrary{
 const seen=new Set<string>(),favorites=[...newer.favorites,...older.favorites].filter(t=>{const k=titleKey(t);if(seen.has(k))return false;seen.add(k);return true});
 const latest=new Map<string,WatchLibrary['history'][number]>();
 for(const h of [...older.history,...newer.history]){const k=titleKey(h.title),old=latest.get(k);if(!old||h.updatedAt>=old.updatedAt)latest.set(k,h);}
 return parseLibrary(JSON.stringify({favorites,history:[...latest.values()]}));
}
export function mergeEpisodes(older:Episodes,newer:Episodes):Episodes{
 const out:Episodes={};
 for(const side of [older,newer])for(const [show,marks] of Object.entries(side))for(const [key,mark] of Object.entries(marks)){
  const shelf=out[show]||(out[show]={}),old=shelf[key];if(!old||mark.updatedAt>=old.updatedAt)shelf[key]=mark;
 }
 return parseEpisodes(JSON.stringify(out));
}
/**
 * dirty=false only pulls. A device that saw the latest revision replaces the copy (keeps its removals);
 * a device that missed another device's update is merged in.
 */
export function nextDoc(stored:SyncDoc|null,body:{rev:number;dirty:boolean;library?:unknown;episodes?:unknown}):SyncDoc|null{
 if(!body.dirty)return null;
 const library=parseLibrary(JSON.stringify(body.library??{})),episodes=parseEpisodes(JSON.stringify(body.episodes??{}));
 if(!stored)return {library,episodes,rev:1};
 if(body.rev===stored.rev)return {library,episodes,rev:stored.rev+1};
 return {library:mergeLibrary(stored.library,library),episodes:mergeEpisodes(stored.episodes,episodes),rev:stored.rev+1};
}
