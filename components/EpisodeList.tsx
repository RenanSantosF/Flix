'use client';
import {useEffect,useState} from 'react';
import FadeImage from './FadeImage';
import Icon from './Icons';
import {imageUrl} from '../lib/catalog';
import {episodeFraction,readEpisodes} from '../lib/episode-progress';
import {readLibrary} from '../lib/watch-library';
import type {EpisodeMark} from '../lib/episode-progress';
type Season={season_number:number;episode_count:number;name:string};
type Episode={number:number;name:string;overview:string;still:string|null;runtime:number};
const cache=new Map<string,Promise<Episode[]|null>>();
function loadSeason(show:number,season:number){
 const key=show+':'+season;
 if(!cache.has(key))cache.set(key,fetch(`/api/season?id=${show}&season=${season}`).then(r=>r.ok?r.json():null).then(d=>Array.isArray(d?.episodes)?d.episodes as Episode[]:null).catch(()=>{cache.delete(key);return null}));
 return cache.get(key)!;
}
export default function EpisodeList({show,seasons,season,episode,onPick}:{show:number;seasons:Season[];season:number;episode:number;onPick:(season:number,episode:number)=>void}){
 const [browsing,setBrowsing]=useState(season),[episodes,setEpisodes]=useState<Episode[]|null>(null),[failed,setFailed]=useState(false),[marks,setMarks]=useState<Record<string,EpisodeMark>>({});
 useEffect(()=>setBrowsing(season),[season]);
 useEffect(()=>{let live=true;setEpisodes(null);setFailed(false);loadSeason(show,browsing).then(list=>{if(!live)return;if(list)setEpisodes(list);else setFailed(true)});return()=>{live=false}},[show,browsing]);
 useEffect(()=>{
  // Older installs only kept the last watched episode in the history; show that one too.
  const sync=()=>{const m={...readEpisodes(show)},h=readLibrary().history.find(h=>h.title.media_type==='tv'&&h.title.id===show);
   if(h&&h.duration>0&&!m[`${h.season}:${h.episode}`])m[`${h.season}:${h.episode}`]={position:h.position,duration:h.duration,updatedAt:h.updatedAt};setMarks(m);};
  sync();addEventListener('flix:episodes',sync);addEventListener('flix:library',sync);return()=>{removeEventListener('flix:episodes',sync);removeEventListener('flix:library',sync)};
 },[show]);
 const count=seasons.find(s=>s.season_number===browsing)?.episode_count||1;
 const ordered=[...seasons].sort((a,b)=>(a.season_number||1e6)-(b.season_number||1e6));
 // Without episode details (offline or provider error) the list still offers plain numbered episodes.
 const rows:Episode[]=episodes||(failed?Array.from({length:count},(_,i)=>({number:i+1,name:`Episódio ${i+1}`,overview:'',still:null,runtime:0})):[]);
 return <section className="episodes" aria-label="Episódios">
  <div className="episodes-head"><h2>Episódios</h2>{seasons.length>1&&<span>{seasons.length} temporadas</span>}</div>
  {seasons.length>1&&<div className="season-chips" role="tablist" aria-label="Temporadas">{ordered.map(s=><button key={s.season_number} role="tab" aria-selected={browsing===s.season_number} className={browsing===s.season_number?'selected':''} onClick={()=>setBrowsing(s.season_number)}>{s.season_number===0?'Extras':'Temporada '+s.season_number}</button>)}</div>}
  <ol className="episodes-list">
   {!episodes&&!failed&&Array.from({length:Math.min(count,4)},(_,i)=><li key={'s'+i} className="episode-row is-loading"><div className="episode-thumb"/><div><i/><i/></div></li>)}
   {rows.map(e=>{
    const current=browsing===season&&e.number===episode,fraction=episodeFraction(marks[`${browsing}:${e.number}`]);
    return <li key={e.number}><button type="button" className={'episode-row'+(current?' current':'')} onClick={()=>onPick(browsing,e.number)} aria-current={current?'true':undefined}>
     <div className="episode-thumb">{e.still?<FadeImage src={imageUrl(e.still,'w300')!} alt="" loading="lazy" decoding="async"/>:<span className="episode-number">{e.number}</span>}
      <span className="episode-play"><Icon name="play" size={16}/></span>
      {fraction>0&&<span className="episode-progress"><i style={{width:Math.max(4,fraction*100)+'%'}}/></span>}</div>
     <div className="episode-text"><strong>{e.number}. {e.name}</strong>
      {e.runtime>0&&<small><span>{e.runtime}min</span></small>}
      {e.overview&&<p>{e.overview}</p>}</div>
    </button></li>})}
  </ol>
 </section>;
}
