'use client';
import {Fragment,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Header,BottomNav} from './AppShell';
import Icon from './Icons';
import {PosterCard,ContinueCard,FavoriteButton,useLibrary} from './Library';
import {GENRE_NAMES,imageUrl,titleHref,titleKey} from '../lib/catalog';
import type {Title} from '../lib/catalog';
import type {DiscoveryShelf} from '../lib/discovery';
import DiscoveryGrid from './DiscoveryGrid';
import {SponsoredPoster,useSponsoredPosters} from './SponsoredPoster';
import FadeImage from './FadeImage';
import AccountCard,{useAccount} from './AccountCard';
type Props={topMovies:Title[];topSeries:Title[];seed:number;movies:Title[];films:Title[];series:Title[];shelves:DiscoveryShelf[];configured:boolean;initialView:'home'|'search'|'list'};
export default function Home({topMovies,topSeries,seed,movies,films,series,shelves,configured,initialView}:Props) {
  const {favorites,history,ready}=useLibrary();
  const account=useAccount();
  const [view,setView]=useState(initialView),[filter,setFilter]=useState<'all'|'movie'|'tv'>('all');
  const [query,setQuery]=useState(''),[results,setResults]=useState<Title[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[understood,setUnderstood]=useState('');
  const [page,setPage]=useState(1),[totalPages,setTotalPages]=useState(1),[retry,setRetry]=useState(0);
  const searchRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{setView(initialView);setFilter('all');setQuery('');setPage(1);setError('');if(initialView==='search')setTimeout(()=>searchRef.current?.focus(),100)},[initialView]);
  useEffect(()=>{
    if(view!=='search'||query.trim().length<2){setResults([]);setBusy(false);return;}
    const controller=new AbortController();setBusy(true);setError('');
    const timer=setTimeout(async()=>{
      try {
        const response=await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&page=${page}&type=${filter}`,{signal:controller.signal});
        if(!response.ok)throw Error();const data=await response.json();
        if(!controller.signal.aborted){setResults(previous=>page===1?data.results:[...previous,...data.results.filter((t:Title)=>!previous.some(p=>titleKey(p)===titleKey(t)))]);setTotalPages(data.total_pages||1);setUnderstood(typeof data.understood==='string'?data.understood.slice(0,80):'');}
      }catch{if(!controller.signal.aborted)setError('A busca não carregou. Vamos tentar de novo?');}
      finally{if(!controller.signal.aborted)setBusy(false);}
    },300);
    return()=>{clearTimeout(timer);controller.abort()};
  },[query,page,view,retry,filter]);
  const continuing=history.filter(h=>!h.completed);
  // The featured title changes once a day, picked from what is trending in the current tab.
  const pool=(filter==='movie'?films:filter==='tv'?series:movies).filter(t=>t.backdrop_path&&t.poster_path).slice(0,10);
  const feature=pool.length?pool[seed%pool.length]:undefined;
  const filtered=(titles:Title[])=>filter==='all'?titles:titles.filter(t=>t.media_type===filter);
  const sponsored=useSponsoredPosters();
  function top(label:string,titles:Title[]){return titles.length>0&&<section className="shelf top-shelf"><div className="section-heading"><h2>{label}</h2></div><div className="poster-rail top-rail">{titles.slice(0,10).map((t,i)=><Link key={titleKey(t)} href={titleHref(t)} className="top-card" aria-label={`${i+1}º ${t.title}`}><span className="top-rank" aria-hidden="true">{i+1}</span><span className="top-art">{t.poster_path&&<FadeImage src={imageUrl(t.poster_path,'w342')!} alt="" loading="lazy" decoding="async"/>}</span></Link>)}</div></section>}
  // Sponsored posters sit fourth in every other unranked rail, so they never lead a row or crowd one.
  let railCount=0;
  function rail(label:string,titles:Title[],rank=false,id?:string){if(!titles.length)return false;const n=rank?-1:railCount++,ad=n>=0&&n%2===0?sponsored[n/2]:undefined;return <section className="shelf" id={id}><div className="section-heading"><h2>{label}</h2></div><div className="poster-rail">{titles.map((title,index)=><Fragment key={titleKey(title)}>{ad&&index===3&&<SponsoredPoster item={ad}/>}<PosterCard title={title} index={rank?index:undefined}/></Fragment>)}</div></section>}
  return <main className="app-page"><Header/>
    {view==='home'&&<><div className="browse-tabs" role="group" aria-label="Filtrar catálogo">{([{id:'all',label:'Para você'},{id:'movie',label:'Filmes'},{id:'tv',label:'Séries'}] as const).map(tab=><button type="button" key={tab.id} className={filter===tab.id?'selected':''} aria-pressed={filter===tab.id} onClick={()=>{setFilter(tab.id);setPage(1)}}>{tab.label}</button>)}<Link href="/ao-vivo" className="live-tab"><Icon name="live" size={15}/> Ao vivo</Link></div>
    {feature&&<section className="feature-card" key={titleKey(feature)}>
      <Link href={titleHref(feature)} className="feature-art" aria-label={`Detalhes de ${feature.title}`}><FadeImage className="feature-poster" src={imageUrl(feature.poster_path,'w780')!} alt="" fetchPriority="high"/><FadeImage className="feature-backdrop" src={imageUrl(feature.backdrop_path,'w1280')!} alt=""/><span className="feature-fade"/></Link>
      <div className="feature-body"><h1>{feature.title}</h1>
        <p className="feature-tags">{[feature.media_type==='tv'?'Série':'Filme',feature.release_date?.slice(0,4),...(feature.genre_ids||[]).map(id=>GENRE_NAMES[id]).filter(Boolean).slice(0,2)].filter(Boolean).map((t,i)=><span key={i}>{t}</span>)}</p>
        <div className="feature-buttons"><Link className="button button-light" href={titleHref(feature)+'?play=1'}><Icon name="play" size={20}/>Assistir</Link><FavoriteButton title={feature}/></div>
      </div></section>}
    <div className="home-content"><Link href="/ao-vivo" className="live-callout"><span className="live-callout-icon"><Icon name="live" size={24}/></span><span><small>SEU LUGAR NA TRANSMISSÃO</small><strong>Canais ao vivo e agenda de jogos</strong><span>Encontre o canal e acompanhe a partida.</span></span><Icon name="chevron" size={20}/></Link>{ready&&filtered(continuing.map(h=>h.title)).length>0&&<section className="shelf continue-shelf"><div className="section-heading"><h2>Continuar assistindo<span className="heading-dot"/></h2><Link href="/?view=list">Ver tudo <Icon name="chevron" size={14}/></Link></div><div className="continue-rail">{continuing.filter(h=>filter==='all'||h.title.media_type===filter).map(h=><ContinueCard key={titleKey(h.title)} entry={h}/>)}</div></section>}
    {!configured?<section className="empty-state"><Icon name="play" size={36}/><h2>O catálogo está sendo preparado</h2><p>Volte em instantes para descobrir suas próximas histórias.</p></section>:<>{rail('Em alta agora',filtered(movies))}{filter!=='tv'&&top('Top 10 filmes no Flix hoje',topMovies)}{filter!=='movie'&&top('Top 10 séries no Flix hoje',topSeries)}{filter!=='tv'&&rail('Filmes para a sua próxima sessão',films)}{filter!=='movie'&&rail('Séries que prendem',series)}{shelves.filter(s=>filter==='all'||s.type===filter).map(s=><div key={s.id}>{rail(s.label,s.titles,false,'shelf-'+s.id)}</div>)}{favorites.length>0&&rail('Da sua lista',filtered(favorites))}<DiscoveryGrid key={filter} titles={[...movies,...films,...series,...shelves.flatMap(s=>s.titles)]} filter={filter}/>{movies.length===0&&films.length===0&&series.length===0&&<div className="empty-state"><h2>O catálogo não carregou</h2><p>Confira sua conexão e tente novamente.</p><button className="button button-glass" onClick={()=>location.reload()}><Icon name="refresh"/>Tentar novamente</button></div>}</>}
    <footer className="app-footer"><span className="wordmark">FLIX<span>·</span></span><p>Sua próxima história está aqui.</p></footer></div></>}
    {view==='search'&&<section className="library-page"><div className="page-heading"><span className="eyebrow">DESCUBRA SUA PRÓXIMA HISTÓRIA</span><h1>O que vamos assistir?</h1></div><form className="search-field" onSubmit={e=>{e.preventDefault();searchRef.current?.blur()}} role="search"><Icon name="search"/><input ref={searchRef} aria-label="Buscar filmes e séries" placeholder="Título, ator, gênero… ex.: comédia anos 90" type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} autoComplete="off" enterKeyHint="search"/>{query&&<button className="icon-button" type="button" aria-label="Limpar busca" onClick={()=>{setQuery('');setPage(1);searchRef.current?.focus()}}><Icon name="close" size={18}/></button>}</form><div className="filter-chips" role="group" aria-label="Tipo de resultado">{([{id:'all',label:'Tudo'},{id:'movie',label:'Filmes'},{id:'tv',label:'Séries'}] as const).map(tab=><button key={tab.id} aria-pressed={filter===tab.id} className={filter===tab.id?'selected':''} onClick={()=>{setFilter(tab.id);setPage(1)}}>{tab.label}</button>)}</div>
    <div className="section-heading"><h2>{query.trim().length>=2?'Resultados da busca':'Explore o catálogo'}</h2>{understood&&query.trim().length>=2&&<span className="search-understood">Entendi: {understood}</span>}{busy&&<span role="status">Buscando…</span>}</div>{error?<div className="empty-state" role="alert"><p>{error}</p><button className="button button-glass" onClick={()=>setRetry(n=>n+1)}>Tentar novamente</button></div>:<><div className="poster-grid" aria-busy={busy}>{(query.trim().length>=2?filtered(results):filtered(movies)).map(t=><PosterCard key={titleKey(t)} title={t}/>)}{busy&&results.length===0&&Array.from({length:9},(_,i)=><div key={i} className="poster-skeleton"/>)}</div>{query.trim().length>=2&&!busy&&!filtered(results).length&&<div className="empty-state"><Icon name="search" size={32}/><h2>Nenhum título por aqui</h2><p>Tente outro nome ou selecione “Tudo”.</p></div>}{query.trim().length>=2&&page<totalPages&&<button className="button button-glass load-more" disabled={busy} onClick={()=>setPage(p=>p+1)}>{busy?'Carregando…':'Mostrar mais resultados'}</button>}</>}</section>}
    {view==='list'&&<section className="library-page"><div className="page-heading"><span className="eyebrow">SEU ESPAÇO</span><h1>Minha lista<span className="accent">.</span></h1><p>As histórias que você guarda. E as que ainda quer terminar.</p></div><AccountCard/>{ready&&continuing.length>0&&<section className="shelf"><div className="section-heading"><h2>Continuar assistindo</h2><Icon name="clock" size={18}/></div><div className="continue-rail">{continuing.map(h=><ContinueCard key={titleKey(h.title)} entry={h}/>)}</div></section>}<div className="section-heading"><h2>Salvos para depois</h2><span>{favorites.length} títulos</span></div><div className="poster-grid">{favorites.map(t=><PosterCard key={titleKey(t)} title={t}/>)}</div>{ready&&!favorites.length&&<div className="empty-state"><span className="empty-icon"><Icon name="plus" size={32}/></span><h2>Sua lista começa com uma escolha</h2><p>Toque no + de um título para guardá-lo aqui.</p><Link href="/" className="button button-light">Explorar catálogo</Link></div>}{!account.phone&&<p className="local-note">Sem conta, sua lista e seu histórico ficam só neste dispositivo.</p>}</section>}
    <BottomNav active={view}/>
  </main>;
}
