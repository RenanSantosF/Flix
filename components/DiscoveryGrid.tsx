'use client';
import {useEffect,useRef,useState} from 'react';
import {PosterCard} from './Library';
import {titleKey} from '../lib/catalog';
import {uniqueTitles} from '../lib/discovery';
import type {Title} from '../lib/catalog';

export default function DiscoveryGrid({titles,filter}:{titles:Title[];filter:'all'|'movie'|'tv'}){
  const [items,setItems]=useState(()=>uniqueTitles(titles).filter(t=>filter==='all'||t.media_type===filter));
  const [visible,setVisible]=useState(24),[page,setPage]=useState(2),[hasMore,setHasMore]=useState(true);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>pending.current?.abort(),[]);
  async function more(){
    if(busy)return;
    if(visible<items.length){setVisible(n=>n+24);return;}
    const controller=new AbortController();pending.current=controller;setBusy(true);setError('');
    try{
      const response=await fetch(`/api/discover?type=${filter}&page=${page}`,{signal:controller.signal});
      if(!response.ok)throw Error();const data=await response.json();
      if(!Array.isArray(data.results))throw Error();
      if(controller.signal.aborted)return;
      setItems(previous=>uniqueTitles([...previous,...data.results]));
      setVisible(n=>n+24);setPage(n=>n+1);setHasMore(!!data.has_more);
    }catch{if(!controller.signal.aborted)setError('As próximas sugestões não carregaram. Tente novamente.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  return <section className="discovery-grid-section" id="explorar"><div className="section-heading"><div><span className="eyebrow">SEM PRECISAR BUSCAR</span><h2>Deixe a próxima história te encontrar</h2></div><span>{items.length} descobertas</span></div>
    <div className="poster-grid" aria-busy={busy}>{items.slice(0,visible).map(t=><PosterCard key={titleKey(t)} title={t}/>)}{busy&&Array.from({length:6},(_,i)=><div className="poster-skeleton" key={'loading'+i}/>)}</div>
    {error&&<p className="discovery-error" role="alert">{error}</p>}
    {(visible<items.length||hasMore)&&<button className="button button-glass load-more" onClick={more} disabled={busy}>{busy?'Buscando novas histórias…':error?'Tentar novamente':'Quero mais sugestões'}</button>}
  </section>;
}
