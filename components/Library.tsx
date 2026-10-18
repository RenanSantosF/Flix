'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Icon from './Icons';
import {EMPTY_LIBRARY,readLibrary,toggleFavorite,removeHistory,remainingLabel} from '../lib/watch-library';
import type {WatchEntry} from '../lib/watch-library';
import {imageUrl,titleHref,titleKey} from '../lib/catalog';
import type {Title} from '../lib/catalog';
export function useLibrary() {
  const [data,setData]=useState(EMPTY_LIBRARY);const [ready,setReady]=useState(false);
  useEffect(()=>{const update=()=>{setData(readLibrary());setReady(true)};update();window.addEventListener('flix:library',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('flix:library',update);window.removeEventListener('storage',update)}},[]);
  return {...data,ready};
}
export function FavoriteButton({title,compact=false}:{title:Title;compact?:boolean}) {
  const {favorites}=useLibrary();const active=favorites.some(t=>titleKey(t)===titleKey(title));
  return <button type="button" className={compact?'icon-button favorite-button':'button button-glass'} aria-label={active?`Remover ${title.title} da minha lista`:`Adicionar ${title.title} à minha lista`} aria-pressed={active} onClick={()=>toggleFavorite(title)}><Icon name={active?'check':'plus'}/>{!compact&&<span>{active?'Na minha lista':'Minha lista'}</span>}</button>;
}
export function PosterCard({title,index}:{title:Title;index?:number}) {
  return <article className="poster-card"><Link href={titleHref(title)} className="poster-link" aria-label={`${title.title}, ${title.media_type==='tv'?'série':'filme'}`}><div className="poster-art">{title.poster_path?<img src={imageUrl(title.poster_path,'w342')} alt="" loading="lazy" decoding="async"/>:<div className="poster-placeholder"><Icon name="play" size={30}/></div>}{index!==undefined&&<span className="rank">{index+1}</span>}<span className="poster-hover"><Icon name="play"/></span></div><h3>{title.title}</h3><p>{title.release_date?.slice(0,4)|| (title.media_type==='tv'?'Série':'Filme')}<span>{title.vote_average?`★ ${title.vote_average.toFixed(1)}`:''}</span></p></Link><FavoriteButton title={title} compact/></article>;
}
export function ContinueCard({entry}:{entry:WatchEntry}) {
  const {title,position,duration,season,episode}=entry;
  return <article className="continue-card"><Link href={titleHref(title)+'?play=1'} aria-label={`Continuar ${title.title}`}><div className="continue-art">{(title.backdrop_path||title.poster_path)&&<img src={imageUrl(title.backdrop_path||title.poster_path,'w500')} alt="" loading="lazy"/>}<span className="round-play"><Icon name="play" size={20}/></span>{duration>0&&<div className="watch-progress" role="progressbar" aria-label="Progresso assistido" aria-valuenow={Math.min(100,Math.max(0,Math.round(position/duration*100)))} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${Math.min(100,position/duration*100)}%`}}/></div>}</div><div className="continue-copy"><h3>{title.title}</h3><p>{title.media_type==='tv'?`T${season} · E${episode}`:'Filme'}<span>{duration>0?remainingLabel(position,duration):entry.queued?'Próximo episódio':'Retomar título'}</span></p></div></Link><button type="button" className="icon-button remove-history" title="Remover de continuar assistindo" aria-label={`Remover ${title.title} de continuar assistindo`} onClick={()=>removeHistory(titleKey(title))}><Icon name="close" size={16}/></button></article>;
}
