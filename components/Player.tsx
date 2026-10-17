'use client';
import {useMemo,useState} from 'react';
type Season={season_number:number;episode_count:number;name:string};
export default function Player({type,id,seasons}:{type:'movie'|'tv';id:string;seasons:Season[]}){
const available=seasons.filter(s=>s.season_number>=0&&s.episode_count>0);
const first=available.find(s=>s.season_number===1)||available.find(s=>s.season_number>0)||available[0];
const [season,setSeason]=useState(first?.season_number??1);
const [episode,setEpisode]=useState(1);
const selected=available.find(s=>s.season_number===season);
const base='https://superflixapi.fun';
const src=useMemo(()=>type==='movie'?base+'/filme/'+encodeURIComponent(id)+'#noLink':base+'/serie/'+encodeURIComponent(id)+'/'+season+'/'+episode+'#noEpList', [type,id,season,episode]);
return <section className="playerSection"><h2>Assistir agora</h2>{type==='tv'&&<div className="selectors"><label>Temporada <select value={season} onChange={e=>{setSeason(Number(e.target.value));setEpisode(1)}}>{available.map(s=><option key={s.season_number} value={s.season_number}>{s.name||'Temporada '+s.season_number}</option>)}</select></label><label>Episódio <select value={episode} onChange={e=>setEpisode(Number(e.target.value))}>{Array.from({length:selected?.episode_count||1},(_,i)=><option key={i+1} value={i+1}>Episódio {i+1}</option>)}</select></label></div>}<div className="videoFrame"><iframe key={src} src={src} title="Reprodutor SuperFlixAPI" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" referrerPolicy="strict-origin-when-cross-origin" loading="lazy"/></div><p className="playerNote">Tentamos bloquear janelas pop-up do player externo. Anúncios dentro do vídeo ainda podem aparecer, e alguns títulos podem exigir permissões adicionais.</p></section>
}