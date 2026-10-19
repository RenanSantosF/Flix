'use client';
import {useEffect,useRef,useState} from 'react';
import {reportAd} from '../lib/ad-client';
import FadeImage from './FadeImage';
export type Sponsored={token:string;image:string;name:string;advertiser:string;message:string};
// One request per page load; every rail on the page shares the same distinct draw.
let pending:Promise<Sponsored[]>|null=null;
function loadSponsored(){
 pending??=fetch('/api/ads/next?slot=poster&count=3',{cache:'no-store'}).then(r=>r.status===200?r.json():{items:[]}).then(d=>Array.isArray(d.items)?d.items as Sponsored[]:[]).catch(()=>[]);
 return pending;
}
export function useSponsoredPosters(){
 const [items,setItems]=useState<Sponsored[]>([]);
 useEffect(()=>{let live=true;loadSponsored().then(list=>{if(live)setItems(list)});return()=>{live=false}},[]);
 return items;
}
export function SponsoredPoster({item}:{item:Sponsored}){
 const card=useRef<HTMLElement>(null),seen=useRef(false),clicked=useRef(false);
 const [open,setOpen]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{
  const el=card.current;if(!el||failed)return;let timer=0;
  // Counted only after half the poster stays on screen for one second.
  const observer=new IntersectionObserver(([entry])=>{
   clearTimeout(timer);
   if(entry.isIntersecting&&!seen.current)timer=window.setTimeout(()=>{seen.current=true;reportAd(item.token,'impression');observer.disconnect()},1000);
  },{threshold:.5});
  observer.observe(el);return()=>{clearTimeout(timer);observer.disconnect()};
 },[item.token,failed]);
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};addEventListener('keydown',key);return()=>removeEventListener('keydown',key)},[open]);
 if(failed)return null;
 const label=item.advertiser||item.name;
 return <article ref={card} className="poster-card sponsored-card">
  <button type="button" className="poster-link" aria-label={`Anúncio: ${label}`} onClick={()=>{setOpen(true);if(!seen.current){seen.current=true;reportAd(item.token,'impression')}if(!clicked.current){clicked.current=true;reportAd(item.token,'click')}}}>
   <div className="poster-art"><FadeImage src={item.image} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/><span className="sponsored-badge">Patrocinado</span></div>
   <h3>{label}</h3><p>Anúncio</p>
  </button>
  {open&&<div className="sponsored-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={()=>setOpen(false)}>
   <div className="sponsored-sheet-card" onClick={e=>e.stopPropagation()}>
    <img src={item.image} alt=""/>
    <div><span className="sponsored-badge static">Patrocinado</span><h2>{label}</h2>{item.message&&<p>{item.message}</p>}</div>
    <button type="button" className="button button-light" onClick={()=>setOpen(false)}>Voltar ao catálogo</button>
   </div>
  </div>}
 </article>;
}
