'use client';
import {useEffect,useRef,useState} from 'react';
import {clampSkip,expandMacros,pickMedia,skipSeconds,trackingUrls} from '../lib/preroll';
import type {PrerollAd as Ad} from '../lib/preroll';
// Values are inlined at build time. Without either source the content starts directly.
const VAST_URL=process.env.NEXT_PUBLIC_PREROLL_VAST_URL||'';
const VIDEO_URL=process.env.NEXT_PUBLIC_PREROLL_VIDEO_URL||'';
const SKIP=clampSkip(process.env.NEXT_PUBLIC_PREROLL_SKIP_SECONDS);
export const prerollEnabled=/^https:\/\//.test(VAST_URL)||/^https:\/\//.test(VIDEO_URL);
const text=(node:Element|null)=>(node?.textContent||'').trim();
async function loadVast(url:string,depth=0,impressions:string[]=[],events:Record<string,string[]>={}):Promise<Ad|null>{
 if(depth>4)return null;
 const response=await fetch(expandMacros(url),{signal:AbortSignal.timeout(6000),credentials:'omit'});if(!response.ok)return null;
 const xml=new DOMParser().parseFromString(await response.text(),'text/xml');if(xml.querySelector('parsererror'))return null;
 const ad=xml.querySelector('Ad');if(!ad)return null;
 impressions=[...impressions,...[...ad.querySelectorAll('Impression')].map(text)];
 for(const node of ad.querySelectorAll('Linear Tracking'))(events[node.getAttribute('event')||'']??=[]).push(text(node));
 const wrapper=text(ad.querySelector('Wrapper VASTAdTagURI'));
 if(wrapper)return loadVast(wrapper,depth+1,impressions,events);
 const linear=ad.querySelector('InLine Linear');if(!linear)return null;
 const video=pickMedia([...linear.querySelectorAll('MediaFile')].map(m=>({url:text(m),type:m.getAttribute('type')||'',width:Number(m.getAttribute('width'))||0,height:Number(m.getAttribute('height'))||0})));
 if(!video)return null;
 const offset=linear.getAttribute('skipoffset');
 return {video,impressions,events,skipAfter:offset?-1:SKIP,...(offset?{offset}:{})};
}
const ping=(urls:string[]|undefined)=>{for(const url of trackingUrls(urls||[]))new Image().src=url;};
export default function PrerollAd({onDone}:{onDone:()=>void}) {
 const [ad,setAd]=useState<Ad|null>(null),[time,setTime]=useState(0),[duration,setDuration]=useState(0),[muted,setMuted]=useState(false);
 const video=useRef<HTMLVideoElement>(null),done=useRef(false),sent=useRef(new Set<string>());
 const finish=(event?:'complete'|'skip')=>{if(done.current)return;done.current=true;if(event&&ad)ping(ad.events[event]);onDone();};
 const fire=(event:string)=>{if(!ad||sent.current.has(event))return;sent.current.add(event);ping(ad.events[event]);};
 useEffect(()=>{
  let live=true;
  const source=VAST_URL?loadVast(VAST_URL):Promise.resolve<Ad>({video:VIDEO_URL,skipAfter:SKIP,impressions:[],events:{}});
  source.then(result=>{if(live)result?setAd(result):finish()}).catch(()=>{if(live)finish()});
  // No inventory, a blocked request or a stalled network must never hold the viewer back.
  const guard=setTimeout(()=>{if(live&&!sent.current.has('start'))finish()},12000);
  return()=>{live=false;clearTimeout(guard)};
 },[]);
 useEffect(()=>{
  const el=video.current;if(!ad||!el)return;
  el.play().catch(()=>{el.muted=true;setMuted(true);el.play().catch(()=>finish())});
 },[ad]);
 if(!ad)return <div className="preroll preroll-loading" role="status">Preparando sua sessão…</div>;
 const skipAt=ad.skipAfter>=0?ad.skipAfter:skipSeconds(ad.offset,duration,SKIP);
 const left=Math.max(0,Math.ceil(skipAt-time));
 return <div className="preroll"><video ref={video} src={ad.video} playsInline preload="auto" disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" onContextMenu={e=>e.preventDefault()}
  onPlaying={()=>{if(!sent.current.has('impression')){sent.current.add('impression');ping(ad.impressions)}fire('start')}}
  onLoadedMetadata={e=>setDuration(e.currentTarget.duration||0)}
  onTimeUpdate={e=>{const t=e.currentTarget.currentTime,d=e.currentTarget.duration||0;setTime(t);if(d>0){if(t>=d/4)fire('firstQuartile');if(t>=d/2)fire('midpoint');if(t>=d*3/4)fire('thirdQuartile')}}}
  onEnded={()=>finish('complete')} onError={()=>finish()}/>
  <span className="preroll-badge">Anúncio{duration>0&&<> · {Math.max(0,Math.ceil(duration-time))}s</>}</span>
  {muted&&<button className="preroll-sound" onClick={()=>{if(video.current){video.current.muted=false;setMuted(false)}}}>Ativar som</button>}
  <button className="preroll-skip" disabled={left>0} onClick={()=>finish('skip')}>{left>0?`Pular em ${left}`:'Pular anúncio ›'}</button>
 </div>;
}
