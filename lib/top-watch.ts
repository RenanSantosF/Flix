import {dayKey} from './ad-campaigns.ts';
// Daily "most watched" ranking: recent days count more, so the list turns over every day.
export const TOP_WEIGHTS=[1,.6,.35,.2,.1];
export function topDays(now=new Date()){return TOP_WEIGHTS.map((_,i)=>dayKey(new Date(now.getTime()-i*86400000)));}
export function rankTop(days:(Record<string,number>)[],limit=10){
 const score=new Map<string,number>();
 days.forEach((counts,i)=>{const w=TOP_WEIGHTS[i]??0;for(const [key,n] of Object.entries(counts))score.set(key,(score.get(key)||0)+n*w);});
 return [...score.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([key])=>key);
}
export const validDevice=(id:unknown)=>typeof id==='string'&&/^[a-z0-9-]{16,64}$/i.test(id);
// The featured title rotates once a day through the pool, the same for everyone that day.
export function daySeed(now=new Date()){const [y,m,d]=dayKey(now).split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000);}
