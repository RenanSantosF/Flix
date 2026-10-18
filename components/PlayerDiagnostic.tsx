'use client';
import {useEffect,useState} from 'react';
export default function PlayerDiagnostic({resetKey}:{resetKey:string}){
 const [diagnostic,setDiagnostic]=useState(''),[copied,setCopied]=useState(false);
 useEffect(()=>{setDiagnostic('');setCopied(false)},[resetKey]);
 useEffect(()=>{const receive=(event:Event)=>{setDiagnostic(String((event as CustomEvent).detail||'').slice(0,1200));setCopied(false)};window.addEventListener('flix:diagnostic',receive);return()=>window.removeEventListener('flix:diagnostic',receive)},[]);
 if(!diagnostic)return null;
 return <details className="player-diagnostic" open><summary>Detalhes da reprodução</summary><p>{diagnostic}</p><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(diagnostic);setCopied(true)}catch{setCopied(false)}}}>{copied?'Copiado':'Copiar diagnóstico'}</button></details>;
}
