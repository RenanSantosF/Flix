import {normalizeTitle,titleKey} from './catalog.ts';
import type {MediaType,Title} from './catalog.ts';

export type DiscoveryShelf={id:string;label:string;type:MediaType;titles:Title[]};
export const discoveryShelves=[
  {id:'action',label:'Uma dose de adrenalina',type:'movie',genre:28},
  {id:'comedy',label:'Para deixar o dia mais leve',type:'movie',genre:35},
  {id:'scifi',label:'Fora deste mundo',type:'movie',genre:878},
  {id:'thriller',label:'Só mais uma cena',type:'movie',genre:53},
  {id:'animation',label:'Mundos de animação',type:'movie',genre:16},
  {id:'drama',label:'Séries para mergulhar',type:'tv',genre:18},
  {id:'crime',label:'Mistérios que prendem',type:'tv',genre:80},
  {id:'documentary',label:'Histórias da vida real',type:'tv',genre:99},
] as const;

export function uniqueTitles(titles:Title[]):Title[]{
  const seen=new Set<string>();
  return titles.filter(title=>{const key=titleKey(title);if(seen.has(key))return false;seen.add(key);return true});
}
export function cleanTitles(data:any,type?:MediaType):Title[]{
  if(!Array.isArray(data?.results))return [];
  return uniqueTitles(data.results.map((item:unknown)=>normalizeTitle(item,type)).filter((t:Title|null):t is Title=>!!t));
}
export function makeShelves(data:unknown[],excluded:Title[]=[]):DiscoveryShelf[]{
  const seen=new Set(excluded.map(titleKey));
  return discoveryShelves.map((s,index)=>({id:s.id,label:s.label,type:s.type,titles:cleanTitles(data[index],s.type).filter(t=>{
    const key=titleKey(t);if(seen.has(key))return false;seen.add(key);return true;
  })})).filter(s=>s.titles.length>0);
}
