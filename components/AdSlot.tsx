'use client';
import {useEffect,useRef} from 'react';
import {adDocument,adFormat} from '../lib/ads';
import type {AdSize} from '../lib/ads';
// Values are inlined at build time; an empty key renders nothing.
const KEYS:Record<AdSize,string|undefined>={banner:process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY,rect:process.env.NEXT_PUBLIC_ADSTERRA_RECT_KEY};
const HOST=process.env.NEXT_PUBLIC_ADSTERRA_HOST;
export default function AdSlot({size='banner'}:{size?:AdSize}) {
 const frame=useRef<HTMLIFrameElement>(null);const html=adDocument(KEYS[size],size,HOST);
 useEffect(()=>{
  if(!html)return;
  // A tap inside the cross-origin ad moves focus to its iframe. The Android app only opens
  // the advertiser in the external browser right after this signal; other pop-ups stay blocked.
  const blur=()=>setTimeout(()=>{if(document.activeElement===frame.current)window.FlixControl?.postMessage(JSON.stringify({type:'ad-tap'}))},0);
  window.addEventListener('blur',blur);return()=>window.removeEventListener('blur',blur);
 },[html]);
 if(!html)return null;
 const {width,height}=adFormat(size);
 return <aside className={'ad-slot ad-'+size} aria-label="Publicidade"><span>PUBLICIDADE</span><iframe ref={frame} title="Publicidade" srcDoc={html} width={width} height={height} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" scrolling="no" loading="lazy"/></aside>;
}
