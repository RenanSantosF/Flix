'use client';
import {useEffect,useRef,useState} from 'react';
import {expandMacros,pickMedia,skipSeconds,trackingUrls} from '../lib/preroll';
import {reportAd as report} from '../lib/ad-client';
type Delivery={token:string;kind:'video'|'vast';url:string;skipAfter:number;useVastSkip:boolean;minutesBetween:number};
type Ready={video:string;skipAt:number|null;offset:string;impressions:string[];events:Record<string,string[]>};
const LAST='flix-ad-last';
const text=(node:Element|null)=>(node?.textContent||'').trim();
async function loadVast(url:string,depth=0,impressions:string[]=[],events:Record<string,string[]>={}):Promise<Omit<Ready,'skipAt'>|null>{
 if(depth>4)return null;
 const response=await fetch(expandMacros(url),{signal:AbortSignal.timeout(6000),credentials:'omit'});if(!response.ok)return null;
 const xml=new DOMParser().parseFromString(await response.text(),'text/xml');if(xml.querySelector('parsererror'))return null;
 const ad=xml.querySelector('Ad');if(!ad)return null;
 impressions=[...impressions,...[...ad.querySelectorAll('Impression')].map(text)];
 for(const node of ad.querySelectorAll('Linear Tracking'))(events[node.getAttribute('event')||'']??=[]).push(text(node));
 const wrapper=text(ad.querySelector('Wrapper VASTAdTagURI'));if(wrapper)return loadVast(wrapper,depth+1,impressions,events);
 const linear=ad.querySelector('InLine Linear');if(!linear)return null;
 const video=pickMedia([...linear.querySelectorAll('MediaFile')].map(m=>({url:text(m),type:m.getAttribute('type')||'',width:Number(m.getAttribute('width'))||0,height:Number(m.getAttribute('height'))||0})));
 return video?{video,offset:linear.getAttribute('skipoffset')||'',impressions,events}:null;
}
const ping=(urls:string[]|undefined)=>{for(const url of trackingUrls(urls||[]))new Image().src=url;};
function recentlyShown(){try{const [at,minutes]=(localStorage.getItem(LAST)||'').split(':').map(Number);return at>0&&minutes>0&&Date.now()-at<minutes*60000}catch{return false}}
const RING=2*Math.PI*15;
const clock=(s:number)=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
export default function PrerollAd({onDone,slot='preroll'}:{onDone:()=>void;slot?:'preroll'|'live'}) {
 const [ad,setAd]=useState<Ready|null>(null),[time,setTime]=useState(0),[duration,setDuration]=useState(0),[muted,setMuted]=useState(false),[playing,setPlaying]=useState(false),[leaving,setLeaving]=useState(false);
 const video=useRef<HTMLVideoElement>(null),done=useRef(false),sent=useRef(new Set<string>()),delivery=useRef<Delivery|null>(null);
 const finish=(event?:'complete'|'skip'|'error')=>{
  if(done.current)return;done.current=true;const d=delivery.current;
  if(d&&event&&sent.current.has('impression')){report(d.token,event);if(event!=='error')ping(ad?.events[event]);}
  // A short fade hands the frame over to the content instead of cutting abruptly.
  if(sent.current.has('impression')){video.current?.pause();setLeaving(true);setTimeout(onDone,320);}else onDone();
 };
 const fire=(event:string)=>{if(!ad||sent.current.has(event))return;sent.current.add(event);ping(ad.events[event]);};
 useEffect(()=>{
  let live=true;const stop=()=>{if(live)finish()};
  if(recentlyShown()){finish();return;}
  (async()=>{
   const response=await fetch('/api/ads/next?slot='+slot,{cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(response.status!==200)return stop();
   const d=await response.json() as Delivery;delivery.current=d;
   const media=d.kind==='vast'?await loadVast(d.url):{video:d.url,offset:'',impressions:[],events:{}};
   if(!live)return;if(!media)return stop();
   setAd({...media,skipAt:d.useVastSkip&&media.offset?null:d.skipAfter});
  })().catch(stop);
  // No inventory, a blocked request or a stalled network must never hold the viewer back.
  const guard=setTimeout(()=>{if(!sent.current.has('impression'))stop()},12000);
  return()=>{live=false;clearTimeout(guard)};
 },[]);
 useEffect(()=>{
  const el=video.current;if(!ad||!el)return;
  el.play().catch(()=>{el.muted=true;setMuted(true);el.play().catch(()=>finish())});
 },[ad]);
 if(!ad)return <div className="preroll preroll-loading" role="status" aria-label="Preparando sua sessão"><span className="wordmark">FLIX<span>·</span></span><i className="preroll-loader"/></div>;
 const skipAt=ad.skipAt??skipSeconds(ad.offset,duration,5);
 const left=Math.max(0,skipAt-time),ready=playing&&left<=0;
 return <div className={'preroll'+(playing?' is-playing':'')+(leaving?' is-leaving':'')}><video ref={video} src={ad.video} playsInline preload="auto" disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" onContextMenu={e=>e.preventDefault()}
  onPlaying={()=>{
   setPlaying(true);
   if(sent.current.has('impression'))return;sent.current.add('impression');ping(ad.impressions);fire('start');
   const d=delivery.current;if(d){report(d.token,'impression');try{localStorage.setItem(LAST,Date.now()+':'+d.minutesBetween)}catch{}}
  }}
  onLoadedMetadata={e=>setDuration(e.currentTarget.duration||0)}
  onTimeUpdate={e=>{const t=e.currentTarget.currentTime,d=e.currentTarget.duration||0;setTime(t);if(d>0){if(t>=d/4)fire('firstQuartile');if(t>=d/2)fire('midpoint');if(t>=d*3/4)fire('thirdQuartile')}}}
  onEnded={()=>finish('complete')} onError={()=>finish('error')}/>
  <div className="preroll-shade"/>
  <div className="preroll-top"><span className="preroll-badge"><b>Anúncio</b>{duration>0&&<>{clock(Math.max(0,duration-time))}</>}</span>
   {muted&&<button className="preroll-sound" onClick={()=>{if(video.current){video.current.muted=false;setMuted(false)}}}>🔊 Ativar som</button>}</div>
  <p className="preroll-note">{slot==='live'?'A transmissão começa logo após':'Seu vídeo começa logo após'}</p>
  <button className={'preroll-skip'+(ready?' ready':'')} disabled={!ready} onClick={()=>finish('skip')} aria-live="polite">
   {ready?<>Pular anúncio<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 5l9 7-9 7zM17 5h2v14h-2z" fill="currentColor"/></svg></>
   :<><svg className="preroll-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle cx="18" cy="18" r="15" style={{strokeDasharray:RING,strokeDashoffset:RING*(skipAt>0?left/skipAt:0)}}/></svg><span>Pular em {Math.ceil(left)}</span></>}
  </button>
  <div className="preroll-progress"><i style={{transform:`scaleX(${duration>0?Math.min(1,time/duration):0})`}}/></div>
 </div>;
}
