'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Icon from './Icons';
import PlayerDiagnostic from './PlayerDiagnostic';
import ProviderFrame from './ProviderFrame';
import PrerollAd from './PrerollAd';
import {useLibrary} from './Library';
import {resumePosition,recordPlayback,queueEpisode,readLibrary,timeLabel} from '../lib/watch-library';
import {imageUrl,titleKey} from '../lib/catalog';
import type {Title} from '../lib/catalog';
declare global {interface Window {FlixControl?:{postMessage:(message:string)=>void}}}
type Season={season_number:number;episode_count:number;name:string};
export default function Player({type,id,title,seasons,nativeApp=false,autoPlay=false,playRequest=0}:{title:Title;nativeApp?:boolean;type:'movie'|'tv';id:string;seasons:Season[];autoPlay?:boolean;playRequest?:number}){
const {ready}=useLibrary();
const [started,setStarted]=useState(false),[notice,setNotice]=useState(''),[reload,setReload]=useState(0),[ended,setEnded]=useState(false);
const initialized=useRef(false),lastSave=useRef(0),endHandled=useRef(false);
const available=seasons.filter(s=>s.season_number>=0&&s.episode_count>0);
const first=available.find(s=>s.season_number===1)||available.find(s=>s.season_number>0)||available[0];
const [season,setSeason]=useState(first?.season_number??1);
const [episode,setEpisode]=useState(1);
const [mediaReady,setMediaReady]=useState(false),[remaining,setRemaining]=useState(Infinity),[countdown,setCountdown]=useState(0),[cancelled,setCancelled]=useState(false);
const nextRef=useRef<()=>void>(()=>{});
// The pre-roll plays once per visit, before the first content load; episode changes go straight to content.
const [adDone,setAdDone]=useState(false);
const playing=started&&adDone;
useEffect(()=>{
if(!ready||initialized.current)return;initialized.current=true;
const old=readLibrary().history.find(h=>titleKey(h.title)===titleKey(title)&&!h.completed);
if(old&&type==='tv'){
 const valid=available.find(s=>s.season_number===old.season);
 if(valid){setSeason(old.season);setEpisode(Math.min(old.episode,valid.episode_count));}
}
if(autoPlay){setStarted(true);setTimeout(()=>document.getElementById('assistir')?.scrollIntoView({block:'start'}),150)}
},[ready,autoPlay,type,title,available]);
useEffect(()=>{if(playRequest>0){setStarted(true);setEnded(false)}},[playRequest]);
useEffect(()=>{
if(!playing||!initialized.current)return;
const resume=resumePosition(title,season,episode);lastSave.current=0;setEnded(false);setRemaining(Infinity);setCountdown(0);setCancelled(false);setNotice('');setMediaReady(false);endHandled.current=false;
window.FlixControl?.postMessage(JSON.stringify({type:'context',key:titleKey(title),title:title.title,season,episode,resume}));
return()=>{window.FlixControl?.postMessage(JSON.stringify({type:'clear'}));};
},[playing,title,season,episode,reload]);
useEffect(()=>{
const progress=(event:Event)=>{
const data=(event as CustomEvent).detail;
if(!playing||data?.key!==titleKey(title)||data.season!==season||data.episode!==episode)return;
if(data.error){setNotice('Este servidor não conseguiu reproduzir o vídeo (erro '+data.error+'). Selecione outro servidor no player ou recarregue.');return;}
if(data.playing){setMediaReady(true);setNotice(old=>old.startsWith('Este servidor não conseguiu')?'':old);}
if(data.ended)setEnded(true);
if(Number.isFinite(data.duration)&&data.duration>0)setRemaining(Math.max(0,data.duration-data.position));
if(!data.playing||data.ended||Date.now()-lastSave.current>5000){if(recordPlayback(title,season,episode,data.position,data.duration,!!data.playing))lastSave.current=Date.now();}
if(data.ended&&!endHandled.current&&type==='tv'){
 endHandled.current=true;
 const current=available.find(s=>s.season_number===season),following=available.find(s=>s.season_number>season);
 if(episode<(current?.episode_count||1))queueEpisode(title,season,episode+1);
 else if(following)queueEpisode(title,following.season_number,1);
}
};
const message=(event:Event)=>{setNotice(String((event as CustomEvent).detail||'').slice(0,200));};
window.addEventListener('flix:progress',progress);window.addEventListener('flix:notice',message);
return()=>{window.removeEventListener('flix:progress',progress);window.removeEventListener('flix:notice',message)};
},[playing,title,season,episode]);
function floatPlayer(){if(window.FlixControl)window.FlixControl.postMessage(JSON.stringify({type:'pip'}));else setNotice('A janela flutuante está disponível na nova versão do aplicativo.');}
const selected=available.find(s=>s.season_number===season);
const src=useMemo(()=>type==='movie'?'https://superflixapi.fun/filme/'+encodeURIComponent(id)+'#noLink':'https://superflixapi.fun/serie/'+encodeURIComponent(id)+'/'+season+'/'+episode+'#noEpList',[type,id,season,episode]);
const nextSeason=available.find(s=>s.season_number>season);
const hasNext=type==='tv'&&(episode<(selected?.episode_count||1)||!!nextSeason);
function nextEpisode(){if(episode<(selected?.episode_count||1))setEpisode(e=>e+1);else if(nextSeason){setSeason(nextSeason.season_number);setEpisode(1)}setStarted(true);setEnded(false);}
const episodeCount=selected?.episode_count||1;
const nextLabel=!hasNext?'':episode<(selected?.episode_count||1)?`T${season} · E${episode+1}`:`T${nextSeason?.season_number} · E1`;
nextRef.current=nextEpisode;
// Credits usually start in the last ~40 s: offer the next episode there, and auto-advance 8 s after the end.
const offerNext=playing&&type==='tv'&&!!nextLabel&&(ended||remaining<=40);
useEffect(()=>{if(!playing||type!=='tv')return;window.FlixControl?.postMessage(JSON.stringify({type:'next',label:nextLabel}));return()=>window.FlixControl?.postMessage(JSON.stringify({type:'next',label:''}))},[playing,type,nextLabel]);
useEffect(()=>{const go=()=>nextRef.current();window.addEventListener('flix:next',go);return()=>window.removeEventListener('flix:next',go)},[]);
useEffect(()=>{if(!ended||!offerNext||cancelled)return;setCountdown(8);const timer=setInterval(()=>setCountdown(n=>{if(n<=1){clearInterval(timer);nextRef.current();return 0}return n-1}),1000);return()=>clearInterval(timer)},[ended,offerNext,cancelled]);
const resumeAt=ready&&!started?resumePosition(title,season,episode):0;

return <section className="playerSection" id="assistir">
<div className="player-identity-bar"><span className="wordmark">FLIX<span>·</span></span><span>{type==='tv'?`T${season} · EPISÓDIO ${episode}`:mediaReady?'APROVEITE A SESSÃO':'SUA SESSÃO COMEÇA AQUI'}</span></div>
<div className={'videoFrame'+(playing&&!mediaReady?' server-selection':'')} id="player-frame">{!started?<button type="button" className="player-cover" aria-label={(resumeAt>0?'Continuar ':'Assistir ')+title.title} onClick={()=>setStarted(true)}>{title.backdrop_path&&<img src={imageUrl(title.backdrop_path,'w1280')} alt=""/>}<span className="player-cover-shade"/><span className="player-cover-play"><i><Icon name="play" size={26}/></i>{resumeAt>0?'Continuar':'Assistir'}</span><span className="player-cover-hint">{resumeAt>0?`De onde parou · ${timeLabel(resumeAt)}`:type==='tv'?`Temporada ${season} · Episódio ${episode}`:'Toque para começar'}</span></button>:!adDone?<PrerollAd onDone={()=>setAdDone(true)}/>:<ProviderFrame key={src+":"+reload} src={src} title="Reprodutor SuperFlixAPI" sessionKey={titleKey(title)} season={season} episode={episode} onReconnect={()=>setReload(n=>n+1)}/>}
{offerNext&&<div className={'next-episode'+(ended?' ended':'')}><button type="button" onClick={nextEpisode}><span className="next-episode-fill" style={{transform:`scaleX(${ended?(cancelled?1:(8-countdown)/8):Math.min(1,Math.max(0,1-remaining/40))})`}}/><Icon name="next" size={18}/><span><small>{ended&&countdown>0?`Começa em ${countdown}s`:'Próximo episódio'}</small><b>{nextLabel}</b></span></button>{ended&&countdown>0&&<button type="button" className="next-episode-cancel" onClick={()=>{setCancelled(true);setCountdown(0)}} aria-label="Cancelar próximo episódio">Cancelar</button>}</div>}</div>
{playing&&<div className="player-controls">{type==='tv'&&<><button className="button button-glass" disabled={episode<=1} onClick={()=>{setEpisode(e=>Math.max(1,e-1));setEnded(false)}}><Icon name="back" size={16}/>Anterior</button><button className={'button '+(ended&&hasNext?'button-accent':'button-glass')} disabled={!hasNext} onClick={nextEpisode}><Icon name="next" size={16}/>Próximo</button></>}{nativeApp&&<button className="button button-glass" onClick={()=>window.FlixControl?.postMessage(JSON.stringify({type:'cast'}))}><Icon name="cast" size={18}/>Transmitir para TV</button>}{nativeApp&&<button className="button button-glass pip-button" onClick={floatPlayer}><Icon name="pip" size={17}/>Janela flutuante</button>}<button className="icon-button" aria-label="Recarregar vídeo" title="Recarregar vídeo" onClick={()=>setReload(n=>n+1)}><Icon name="refresh" size={17}/></button></div>}
{notice&&<p className="player-notice" role="status">{notice}</p>}
{nativeApp&&playing&&<PlayerDiagnostic resetKey={src+reload}/>}
{nativeApp&&playing&&<p className="player-status"><i/>Reprodução protegida · use a janela flutuante para assistir em outros apps</p>}
{type==='tv'&&<><div className="selectors"><label>Temporada<select value={season} onChange={e=>{setSeason(Number(e.target.value));setEpisode(1);setEnded(false)}}>{(available.length?available:[{season_number:1,episode_count:1,name:'Temporada 1'}]).map(s=><option key={s.season_number} value={s.season_number}>{s.name||'Temporada '+s.season_number}</option>)}</select></label><label>Episódio<select value={episode} onChange={e=>{setEpisode(Number(e.target.value));setEnded(false)}}>{Array.from({length:episodeCount},(_,i)=><option key={i+1} value={i+1}>Episódio {i+1}</option>)}</select></label></div></>}</section>;
}
