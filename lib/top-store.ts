import {createHash} from 'node:crypto';
import {normalizeTitle,titleKey,tmdb} from './catalog.ts';
import type {MediaType,Title} from './catalog.ts';
import {dayKey} from './ad-campaigns.ts';
import {pipeline,storeReady} from './ad-store.ts';
import {rankTop,topDays} from './top-watch.ts';
const pairs=(row:any)=>{const out:Record<string,number>={};if(Array.isArray(row))for(let i=0;i<row.length;i+=2)out[row[i]]=Number(row[i+1])||0;return out;};
// One count per device, title and day; titles come from TMDB so the list cannot carry injected text.
export async function recordWatch(type:MediaType,id:number,device:string){
 if(!storeReady())return false;
 const key=`${type}:${id}`,day=dayKey(),seen=createHash('sha256').update(device+'|'+key+'|'+day).digest('hex').slice(0,32);
 const [fresh,known]=await pipeline([['SET','top:seen:'+seen,'1','NX','EX',2*86400],['HEXISTS','top:meta',key]]);
 if(fresh!=='OK')return false;
 if(!known){const title=normalizeTitle(await tmdb(`${type}/${id}`),type);if(!title)return false;await pipeline([['HSET','top:meta',key,JSON.stringify(title)]]);}
 await pipeline([['ZINCRBY',`top:${type}:${day}`,1,key],['EXPIRE',`top:${type}:${day}`,8*86400]]);
 return true;
}
export async function topTitles(type:MediaType):Promise<Title[]>{
 if(!storeReady())return [];
 try{
  const days=await pipeline(topDays().map(day=>['ZRANGE',`top:${type}:${day}`,0,49,'REV','WITHSCORES']));
  const keys=rankTop(days.map(pairs));if(!keys.length)return [];
  const [meta]=await pipeline([['HMGET','top:meta',...keys]]);
  return (meta as (string|null)[]).map(raw=>{try{return raw?normalizeTitle(JSON.parse(raw),type):null}catch{return null}}).filter((t):t is Title=>!!t&&titleKey(t).startsWith(type+':'));
 }catch{return [];}
}
// Few views yet: complete the ten with what is popular on TMDB.
export function fillTop(watched:Title[],popular:Title[]){
 const seen=new Set(watched.map(titleKey));return [...watched,...popular.filter(t=>!seen.has(titleKey(t)))].slice(0,10);
}
