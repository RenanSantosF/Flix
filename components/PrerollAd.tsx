'use client';
import {useEffect,useRef,useState} from 'react';
import {expandMacros,pickMedia,skipSeconds,trackingUrls} from '../lib/preroll';
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
const report=(token:string,event:string)=>{const body=JSON.stringify({token,event});if(!navigator.sendBeacon?.('/api/ads/event',new Blob([body],{type:'application/json'})))fetch('/api/ads/event',{method:'POST',body,headers:{'Content-Type':'application/json'},keepalive:true}).catch(()=>{});};
function recentlyShown(){try{const [at,minutes]=(localStorage.getItem(LAST)||'').split(':').map(Number);return at>0&&minutes>0&&Date.now()-at<minutes*60000}catch{return false}}
export default function PrerollAd({onDone}:{onDone:()=>void}) {
 const [ad,setAd]=useState<Ready|null>(null),[time,setTime]=useState(0),[duration,setDuration]=useState(0),[muted,setMuted]=useState(false);
 const video=useRef<HTMLVideoElement>(null),done=useRef(false),sent=useRef(new Set<string>()),delivery=useRef<Delivery|null>(null);
 const finish=(event?:'complete'|'skip'|'error')=>{
  if(done.current)return;done.current=true;const d=delivery.current;
  if(d&&event&&sent.current.has('impression')){report(d.token,event);if(event!=='error')ping(ad?.events[event]);}
  onDone();
 };
 const fire=(event:string)=>{if(!ad||sent.current.has(event))return;sent.current.add(event);ping(ad.events[event]);};
 useEffect(()=>{
  let live=true;const stop=()=>{if(live)finish()};
  if(recentlyShown()){finish();return;}
  (async()=>{
   const response=await fetch('/api/ads/next',{cache:'no-store',signal:AbortSignal.timeout(5000)});
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
 if(!ad)return <div className="preroll preroll-loading" role="status">Preparando sua sessão…</div>;
 const skipAt=ad.skipAt??skipSeconds(ad.offset,duration,5);
 const left=Math.max(0,Math.ceil(skipAt-time));
 return <div className="preroll"><video ref={video} src={ad.video} playsInline preload="auto" disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" onContextMenu={e=>e.preventDefault()}
  onPlaying={()=>{
   if(sent.current.has('impression'))return;sent.current.add('impression');ping(ad.impressions);fire('start');
   const d=delivery.current;if(d){report(d.token,'impression');try{localStorage.setItem(LAST,Date.now()+':'+d.minutesBetween)}catch{}}
  }}
  onLoadedMetadata={e=>setDuration(e.currentTarget.duration||0)}
  onTimeUpdate={e=>{const t=e.currentTarget.currentTime,d=e.currentTarget.duration||0;setTime(t);if(d>0){if(t>=d/4)fire('firstQuartile');if(t>=d/2)fire('midpoint');if(t>=d*3/4)fire('thirdQuartile')}}}
  onEnded={()=>finish('complete')} onError={()=>finish('error')}/>
  <span className="preroll-badge">Anúncio{duration>0&&<> · {Math.max(0,Math.ceil(duration-time))}s</>}</span>
  {muted&&<button className="preroll-sound" onClick={()=>{if(video.current){video.current.muted=false;setMuted(false)}}}>Ativar som</button>}
  <button className="preroll-skip" disabled={left>0} onClick={()=>finish('skip')}>{left>0?`Pular em ${left}`:'Pular anúncio ›'}</button>
 </div>;
}
