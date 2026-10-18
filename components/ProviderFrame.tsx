'use client';
import {useEffect,useState} from 'react';
import Icon from './Icons';
export default function ProviderFrame({src,title,sessionKey,unrestricted=false,season=1,episode=1,onReconnect}:{src:string;title:string;sessionKey:string;unrestricted?:boolean;season?:number;episode?:number;onReconnect:()=>void}){
 const [detached,setDetached]=useState(false),[active,setActive]=useState(false);
 useEffect(()=>{const receive=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.key!==sessionKey||d.season!==season||d.episode!==episode)return;if(d.active)setDetached(true);setActive(!!d.active)};window.addEventListener('flix:native-session',receive);return()=>window.removeEventListener('flix:native-session',receive)},[sessionKey,season,episode]);
 return <><iframe src={detached?'about:blank':src} title={title} allow="autoplay *; encrypted-media *; picture-in-picture *; fullscreen *; clipboard-write *; accelerometer *; gyroscope *; web-share *" allowFullScreen referrerPolicy={unrestricted?undefined:'strict-origin-when-cross-origin'}/>{detached&&<div className="player-cover"><button type="button" aria-label="Voltar aos servidores" disabled={active} onClick={onReconnect}><Icon name="refresh" size={23}/></button><p>{active?'Reproduzindo no aplicativo':'Voltar aos servidores'}</p></div>}</>;
}
