'use client';
import {useState} from 'react';
import {BottomNav} from './AppShell';
import {FavoriteButton,PosterCard,useLibrary} from './Library';
import Icon from './Icons';
import Player from './Player';
import {imageUrl,titleKey} from '../lib/catalog';
import FadeImage from './FadeImage';
import {timeLabel} from '../lib/watch-library';
import type {Title} from '../lib/catalog';
export type Season={season_number:number;episode_count:number;name:string};
export default function TitleDetail({title,seasons,genres,runtime,nativeApp,autoPlay,similar}:{title:Title;seasons:Season[];genres:string[];runtime:number;nativeApp:boolean;autoPlay:boolean;similar:Title[]}) {
  const [playRequest,setPlayRequest]=useState(0),[more,setMore]=useState(false);const {history}=useLibrary();
  const resume=history.find(h=>titleKey(h.title)===titleKey(title)&&!h.completed);
  function play(){setPlayRequest(n=>n+1);setTimeout(()=>document.getElementById('assistir')?.scrollIntoView({behavior:'smooth',block:'start'}),50);}
  const back=()=>{if(window.history.length>1)window.history.back();else location.assign('/')};
  return <main className="app-page title-page">
    <section className="detail-hero compact">{title.backdrop_path&&<FadeImage className="detail-backdrop" src={imageUrl(title.backdrop_path,'w1280')!} alt="" fetchPriority="high"/>}<div className="detail-gradient"/>
      <button type="button" className="detail-back" aria-label="Voltar" onClick={back}><Icon name="back" size={20}/></button>
      <div className="detail-content"><h1>{title.title}</h1><div className="detail-meta">{!!title.vote_average&&<span className="rating">★ {title.vote_average.toFixed(1)}</span>}<span>{title.release_date?.slice(0,4)}</span><span>{title.media_type==='tv'?`${seasons.filter(s=>s.season_number>0).length||1} temporadas`:runtime?timeLabel(runtime*60):'Filme'}</span><span className="type-tag">{title.media_type==='tv'?'SÉRIE':'FILME'}</span></div>
      <p className={'detail-description'+(more?' open':'')} onClick={()=>setMore(v=>!v)}>{title.overview||'Uma nova história para descobrir.'}</p>{(title.overview||'').length>140&&<button className="detail-more" onClick={()=>setMore(v=>!v)}>{more?'Mostrar menos':'Ler mais'}</button>}
      {resume&&<p className="resume-label">Retome {title.media_type==='tv'?`T${resume.season} · E${resume.episode}`:'de onde parou'}{resume.position>0&&<> em <strong>{timeLabel(resume.position)}</strong></>}</p>}
      <div className="detail-actions"><button className="button button-light" onClick={play}><Icon name="play" size={18}/>{resume?'Continuar':'Assistir'}</button><FavoriteButton title={title}/></div>
      <div className="genres">{genres.map(g=><span key={g}>{g}</span>)}</div></div></section>
    <Player title={title} type={title.media_type} id={String(title.id)} seasons={seasons} nativeApp={nativeApp} autoPlay={autoPlay} playRequest={playRequest}/>
    {similar.length>0&&<section className="detail-similar shelf"><div className="section-heading"><h2>Mais histórias para você</h2></div><div className="poster-rail">{similar.map(t=><PosterCard key={titleKey(t)} title={t}/>)}</div></section>}<BottomNav active="none"/></main>;
}
