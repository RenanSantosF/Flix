'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Icon from './Icons';
import PlayerDiagnostic from './PlayerDiagnostic';
import ProviderFrame from './ProviderFrame';
import {useLibrary} from './Library';
import {startWatching,recordProgress,readLibrary} from '../lib/watch-library';
import {imageUrl,titleKey} from '../lib/catalog';
import type {Title} from '../lib/catalog';
declare global {interface Window {FlixControl?:{postMessage:(message:string)=>void}}}
type Season={season_number:number;episode_count:number;name:string};
export default function Player({type,id,title,seasons,nativeApp=false,adTest=false,autoPlay=false,playRequest=0}:{title:Title;nativeApp?:boolean;adTest?:boolean;type:'movie'|'tv';id:string;seasons:Season[];autoPlay?:boolean;playRequest?:number}){
const {ready}=useLibrary();
const [started,setStarted]=useState(false),[notice,setNotice]=useState(''),[reload,setReload]=useState(0),[ended,setEnded]=useState(false);
const initialized=useRef(false),lastSave=useRef(0),endHandled=useRef(false);
const available=seasons.filter(s=>s.season_number>=0&&s.episode_count>0);
const first=available.find(s=>s.season_number===1)||available.find(s=>s.season_number>0)||available[0];
const [season,setSeason]=useState(first?.season_number??1);
const [episode,setEpisode]=useState(1);
const [mediaReady,setMediaReady]=useState(false);
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
if(!started||!initialized.current)return;
const entry=startWatching(title,season,episode);setEnded(false);setNotice('');setMediaReady(false);endHandled.current=false;
window.FlixControl?.postMessage(JSON.stringify({type:'context',key:titleKey(title),season,episode,resume:entry.position}));
return()=>{window.FlixControl?.postMessage(JSON.stringify({type:'clear'}));};
},[started,title,season,episode,reload]);
useEffect(()=>{
const progress=(event:Event)=>{
const data=(event as CustomEvent).detail;
if(!started||data?.key!==titleKey(title)||data.season!==season||data.episode!==episode)return;
if(data.error){setNotice('Este servidor não conseguiu reproduzir o vídeo (erro '+data.error+'). Selecione outro servidor no player ou recarregue.');return;}
if(data.playing){setMediaReady(true);setNotice(old=>old.startsWith('Este servidor não conseguiu')?'':old);}
if(data.ended)setEnded(true);
if(!data.playing||data.ended||Date.now()-lastSave.current>5000){recordProgress(data.key,season,episode,data.position,data.duration);lastSave.current=Date.now();}
if(data.ended&&!endHandled.current&&type==='tv'){
 endHandled.current=true;
 const current=available.find(s=>s.season_number===season),following=available.find(s=>s.season_number>season);
 if(episode<(current?.episode_count||1))startWatching(title,season,episode+1);
 else if(following)startWatching(title,following.season_number,1);
}
};
const message=(event:Event)=>{setNotice(String((event as CustomEvent).detail||'').slice(0,200));};
window.addEventListener('flix:progress',progress);window.addEventListener('flix:notice',message);
return()=>{window.removeEventListener('flix:progress',progress);window.removeEventListener('flix:notice',message)};
},[started,title,season,episode]);
function floatPlayer(){if(window.FlixControl)window.FlixControl.postMessage(JSON.stringify({type:'pip'}));else setNotice('A janela flutuante está disponível na nova versão do aplicativo.');}
const selected=available.find(s=>s.season_number===season);
const src=useMemo(()=>(type==='movie'?'https://superflixapi.fun/filme/'+encodeURIComponent(id):'https://superflixapi.fun/serie/'+encodeURIComponent(id)+'/'+season+'/'+episode)+(adTest?'':type==='movie'?'#noLink':'#noEpList'),[type,id,season,episode,adTest]);
const nextSeason=available.find(s=>s.season_number>season);
const hasNext=type==='tv'&&(episode<(selected?.episode_count||1)||!!nextSeason);
function nextEpisode(){if(episode<(selected?.episode_count||1))setEpisode(e=>e+1);else if(nextSeason){setSeason(nextSeason.season_number);setEpisode(1)}setStarted(true);setEnded(false);}
const episodeCount=selected?.episode_count||1;

return <section className="playerSection" id="assistir"><div className="player-heading"><h2>{type==='tv'?'Sua sessão':'Hora de assistir'}</h2><span>{type==='tv'?'T'+season+' · Episódio '+episode:'Prepare a pipoca'}</span></div>
<div className={'videoFrame'+(started&&!mediaReady?' server-selection':'')} id="player-frame">{!started?<div className="player-cover">{title.backdrop_path&&<img src={imageUrl(title.backdrop_path,'w780')} alt=""/>}<button type="button" aria-label={'Assistir '+title.title} onClick={()=>setStarted(true)}><Icon name="play" size={23}/></button><p>{type==='tv'?'Temporada '+season+' · Episódio '+episode:title.title}</p></div>:<ProviderFrame key={src+":"+reload} src={src} title="Reprodutor SuperFlixAPI" sessionKey={titleKey(title)} unrestricted={adTest} season={season} episode={episode} onReconnect={()=>setReload(n=>n+1)}/>}</div>
{started&&<div className="player-controls">{type==='tv'&&!adTest&&<><button className="button button-glass" disabled={episode<=1} onClick={()=>{setEpisode(e=>Math.max(1,e-1));setEnded(false)}}><Icon name="back" size={16}/>Anterior</button><button className={'button '+(ended&&hasNext?'button-accent':'button-glass')} disabled={!hasNext} onClick={nextEpisode}><Icon name="next" size={16}/>Próximo</button></>}{nativeApp&&!adTest&&<button className="button button-glass pip-button" onClick={floatPlayer}><Icon name="pip" size={17}/>Janela flutuante</button>}<button className="icon-button" aria-label="Recarregar vídeo" title="Recarregar vídeo" onClick={()=>setReload(n=>n+1)}><Icon name="refresh" size={17}/></button></div>}
{notice&&<p className="player-notice" role="status">{notice}</p>}
{nativeApp&&started&&<PlayerDiagnostic resetKey={src+reload}/>}
{nativeApp&&started&&<p className="player-status"><i/>{adTest?'Modo de teste · anúncios e pop-ups liberados':'Reprodução protegida · use a janela flutuante para assistir em outros apps'}</p>}
{type==='tv'&&!adTest&&<><div className="selectors"><label>Temporada<select value={season} onChange={e=>{setSeason(Number(e.target.value));setEpisode(1);setEnded(false)}}>{(available.length?available:[{season_number:1,episode_count:1,name:'Temporada 1'}]).map(s=><option key={s.season_number} value={s.season_number}>{s.name||'Temporada '+s.season_number}</option>)}</select></label><label>Episódio<select value={episode} onChange={e=>{setEpisode(Number(e.target.value));setEnded(false)}}>{Array.from({length:episodeCount},(_,i)=><option key={i+1} value={i+1}>Episódio {i+1}</option>)}</select></label></div></>}</section>;
}
