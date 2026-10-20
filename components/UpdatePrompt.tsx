'use client';
import {useEffect,useState} from 'react';
import {appBuild} from '../lib/app-release';
import type {AppRelease} from '../lib/app-release';
const SNOOZE='flix-update-later';
// Shown inside the Android app when a newer release exists; "Depois" waits 12 h for the same version.
export default function UpdatePrompt(){
 const [release,setRelease]=useState<AppRelease|null>(null),[build,setBuild]=useState<number|null>(null),[open,setOpen]=useState(false),[started,setStarted]=useState(false),[copied,setCopied]=useState(false);
 useEffect(()=>{
  const current=appBuild(navigator.userAgent);if(current===null)return;setBuild(current);
  let live=true;
  const timer=setTimeout(()=>fetch('/api/app-version').then(r=>r.status===200?r.json():null).then((r:AppRelease|null)=>{
   if(!live||!r||r.versionCode<=current)return;
   try{const [code,until]=(localStorage.getItem(SNOOZE)||'').split(':').map(Number);if(code===r.versionCode&&Date.now()<until)return;}catch{}
   setRelease(r);setOpen(true);
  }).catch(()=>{}),2600);
  return()=>{live=false;clearTimeout(timer)};
 },[]);
 if(!release||!open)return null;
 const later=()=>{try{localStorage.setItem(SNOOZE,release.versionCode+':'+(Date.now()+12*3600000))}catch{};setOpen(false)};
 // Builds before 24 cannot hand links to the system browser, so they get the address to open instead.
 const legacy=build===0;
 const link=location.origin+'/baixar';
 return <div className="update-overlay" role="dialog" aria-modal="true" aria-labelledby="update-title" onClick={later}>
  <div className="update-sheet" onClick={e=>e.stopPropagation()}>
   <div className="update-glow" aria-hidden="true"/>
   <div className="update-icon" aria-hidden="true"><span className="wordmark">F<span>·</span></span><i className="update-arrow"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></i></div>
   <span className="update-badge">NOVA VERSÃO</span>
   <h2 id="update-title">Flix {release.versionName} chegou</h2>
   <p>{started?'O download começou no navegador. Quando terminar, toque no arquivo Flix.apk e em “Atualizar”.':legacy?'Para atualizar, abra este endereço no navegador do celular e instale por cima do app:':'Melhorias e correções esperando por você. Leva menos de um minuto.'}</p>
   {legacy&&!started&&<button type="button" className="update-link" onClick={()=>{navigator.clipboard?.writeText(link).then(()=>setCopied(true)).catch(()=>{})}}>{link.replace(/^https?:\/\//,'')}<small>{copied?'Copiado ✓':'Tocar para copiar'}</small></button>}
   <div className="update-actions">
    {!legacy&&!started&&<a className="button button-light update-go" href="/baixar" onClick={()=>setStarted(true)}>Atualizar agora{release.sizeMb>0&&<small>{release.sizeMb.toLocaleString('pt-BR')} MB</small>}</a>}
    <button type="button" className="button button-glass" onClick={started?()=>setOpen(false):later}>{started?'Fechar':'Depois'}</button>
   </div>
  </div>
 </div>;
}
