// Per-episode progress, kept beside the one-entry-per-title history so episode lists can show bars.
export type EpisodeMark={position:number;duration:number;updatedAt:number};
type Store=Record<string,Record<string,EpisodeMark>>;
export const EPISODES_KEY='flix:episodes:v1';
const MAX_SHOWS=60,MAX_EPISODES=400;
const valid=(m:any):m is EpisodeMark=>m&&[m.position,m.duration,m.updatedAt].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)&&m.duration>0&&m.duration<=604800;
export function parseEpisodes(raw:string|null):Store{
 try{
  const data=JSON.parse(raw||'{}');const out:Store={};if(!data||typeof data!=='object')return out;
  for(const [show,episodes] of Object.entries(data).slice(0,MAX_SHOWS)){
   if(!/^\d{1,12}$/.test(show)||!episodes||typeof episodes!=='object')continue;
   const clean:Record<string,EpisodeMark>={};
   for(const [key,mark] of Object.entries(episodes as object).slice(-MAX_EPISODES))if(/^\d{1,5}:\d{1,5}$/.test(key)&&valid(mark))clean[key]={position:Math.min(mark.position,mark.duration),duration:mark.duration,updatedAt:mark.updatedAt};
   out[show]=clean;
  }
  return out;
 }catch{return {};}
}
export function withEpisode(store:Store,show:number,season:number,episode:number,position:number,duration:number,now=Date.now()):Store{
 if(!Number.isFinite(position)||!Number.isFinite(duration)||duration<=0||duration>604800||position<1)return store;
 const id=String(show),episodes={...(store[id]||{})};delete episodes[`${season}:${episode}`];
 episodes[`${season}:${episode}`]={position:Math.min(position,duration),duration,updatedAt:now};
 const keys=Object.keys(episodes);for(const k of keys.slice(0,Math.max(0,keys.length-MAX_EPISODES)))delete episodes[k];
 const {[id]:_,...rest}=store;const shows=Object.keys(rest);
 const next:Store={...rest,[id]:episodes};for(const k of shows.slice(0,Math.max(0,shows.length+1-MAX_SHOWS)))delete next[k];
 return next;
}
export function episodeFraction(mark?:EpisodeMark){return mark?Math.min(1,mark.position/mark.duration):0;}
export function readEpisodes(show:number):Record<string,EpisodeMark>{
 if(typeof window==='undefined')return {};
 try{return parseEpisodes(localStorage.getItem(EPISODES_KEY))[String(show)]||{}}catch{return {}}
}
export function recordEpisode(show:number,season:number,episode:number,position:number,duration:number){
 try{const next=withEpisode(parseEpisodes(localStorage.getItem(EPISODES_KEY)),show,season,episode,position,duration);localStorage.setItem(EPISODES_KEY,JSON.stringify(next));window.dispatchEvent(new Event('flix:episodes'));}catch{}
}
