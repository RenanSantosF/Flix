'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type Hls from 'hls.js';
import {FILTERED_SANDBOX, loadBrowserPlayer, readPlayerHtml} from '../lib/filtered-player';
import Icon from './Icons';
import {useLibrary} from './Library';
import {startWatching,recordProgress,timeLabel,readLibrary} from '../lib/watch-library';
import {imageUrl,titleKey} from '../lib/catalog';
import type {Title} from '../lib/catalog';
declare global {interface Window {FlixControl?:{postMessage:(message:string)=>void}}}
type PopupMode='filtered'|'balanced'|'strict'|'compatible';
type Season={season_number:number;episode_count:number;name:string};
export default function Player({type,id,title,seasons,nativeApp=false,autoPlay=false,playRequest=0}:{title:Title;nativeApp?:boolean;type:'movie'|'tv';id:string;seasons:Season[];autoPlay?:boolean;playRequest?:number}){
const {ready}=useLibrary();
const [started,setStarted]=useState(false),[notice,setNotice]=useState(''),[reload,setReload]=useState(0),[ended,setEnded]=useState(false);
const initialized=useRef(false),lastSave=useRef(0),resumeAt=useRef(0),endHandled=useRef(false);
const available=seasons.filter(s=>s.season_number>=0&&s.episode_count>0);
const first=available.find(s=>s.season_number===1)||available.find(s=>s.season_number>0)||available[0];
const [season,setSeason]=useState(first?.season_number??1);
const [episode,setEpisode]=useState(1);
const [mode,setMode]=useState<'external'|'native'>('external');
const [popupMode,setPopupMode]=useState<PopupMode>(nativeApp?'compatible':'filtered');
const [draft,setDraft]=useState('');
const [url,setUrl]=useState('');
const [error,setError]=useState('');
const [filteredHtml,setFilteredHtml]=useState('');
const [filterLoading,setFilterLoading]=useState(true);
const [filterError,setFilterError]=useState('');
const [filterDiagnostic,setFilterDiagnostic]=useState('');
const videoRef=useRef<HTMLVideoElement>(null);
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
const entry=startWatching(title,season,episode);resumeAt.current=entry.position;setEnded(false);endHandled.current=false;
window.FlixControl?.postMessage(JSON.stringify({type:'context',key:titleKey(title),season,episode,resume:entry.position}));
return()=>{window.FlixControl?.postMessage(JSON.stringify({type:'clear'}));};
},[started,title,season,episode,reload]);
useEffect(()=>{
const progress=(event:Event)=>{
const data=(event as CustomEvent).detail;
if(!started||data?.key!==titleKey(title)||data.season!==season||data.episode!==episode)return;
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
const src=useMemo(()=>type==='movie'?'https://superflixapi.fun/filme/'+encodeURIComponent(id)+'#noLink':'https://superflixapi.fun/serie/'+encodeURIComponent(id)+'/'+season+'/'+episode+'#noEpList',[type,id,season,episode]);
const filteredSrc=useMemo(()=>{const original=new URL(src);return '/api/player/filter?path='+encodeURIComponent(original.pathname+original.search)+original.hash},[src]);
useEffect(()=>{setUrl('');setDraft('');setError('');setMode('external')},[type,id,season,episode]);
useEffect(()=>{
if(!started||mode!=='external'||popupMode!=='filtered')return;
let cancelled=false;
const browserController=new AbortController();
const serverController=new AbortController();
const browserTimeout=setTimeout(()=>browserController.abort(),8000);
let serverTimeout:ReturnType<typeof setTimeout>|undefined;
setFilteredHtml('');setFilterLoading(true);setFilterError('');setFilterDiagnostic('');
async function prepare(){
let browserReason='';
try{
  const html=await loadBrowserPlayer(src,window.location.origin,browserController.signal);
  if(!cancelled)setFilteredHtml(html);
  return;
}catch(failure){
  if(cancelled)return;
  browserReason=failure instanceof Error&&['verification_required','embed_document_unavailable','invalid_redirect','browser_source_unavailable'].includes(failure.message)?failure.message:'browser_read_blocked';
}finally{clearTimeout(browserTimeout)}
try{
  serverTimeout=setTimeout(()=>serverController.abort(),15000);
  const response=await fetch(filteredSrc,{signal:serverController.signal,cache:'no-store'});
  if(!response.ok){
    const reason=response.headers.get('x-player-error')||'source_unavailable';
    await response.body?.cancel();
    throw new Error(/^[a-z0-9_]+$/.test(reason)?reason:'source_unavailable');
  }
  const html=await readPlayerHtml(response);
  if(!cancelled)setFilteredHtml(html);
}catch(failure){
  if(cancelled)return;
  const reason=serverController.signal.aborted?'source_timeout':failure instanceof Error?failure.message:'source_request_failed';
  setFilterDiagnostic(browserReason+'/'+reason);
  setFilterError(reason==='verification_required'?'O provedor exige uma verificação que não pôde ser concluída neste modo.':reason==='embed_document_unavailable'?'O provedor devolveu uma página de acesso externo, sem o player.':reason==='source_timeout'?'O provedor demorou demais para responder.':/^upstream_http_(403|429)$/.test(reason)?'O provedor recusou o carregamento protegido.':'Não foi possível preparar o player protegido nesta conexão.');
}finally{if(serverTimeout)clearTimeout(serverTimeout)}
}
prepare().catch(()=>{if(!cancelled)setFilterError('Não foi possível preparar o player protegido.')}).finally(()=>{if(!cancelled)setFilterLoading(false)});
return()=>{cancelled=true;browserController.abort();serverController.abort();clearTimeout(browserTimeout);if(serverTimeout)clearTimeout(serverTimeout)}
},[started,mode,popupMode,src,filteredSrc,reload]);
useEffect(()=>{
if(mode!=='native'||!url||!videoRef.current)return;
const video=videoRef.current;
let hls:Hls|null=null;
let cancelled=false;
const onError=()=>setError('Não foi possível reproduzir. Verifique a URL, o formato e a permissão CORS do servidor.');
video.addEventListener('error',onError);
async function attach(){
if(/\.m3u8(?:[?#]|$)/i.test(url)){
const {default:HlsClass}=await import('hls.js');
if(cancelled)return;
if(!HlsClass.isSupported()){video.src=url;video.load();return;}
hls=new HlsClass({enableWorker:true});
hls.loadSource(url);
hls.attachMedia(video);
hls.on(HlsClass.Events.ERROR,(_event,data)=>{if(data.fatal)setError('Falha no streaming HLS. A origem pode exigir autenticação ou bloquear CORS.')});
}else{video.src=url;video.load()}
}
attach().catch(()=>{if(!cancelled)onError()});
return()=>{cancelled=true;video.removeEventListener('error',onError);hls?.destroy();video.removeAttribute('src');video.load()}
},[mode,url]);
function playDirect(){try{const parsed=new URL(draft.trim());if(!['https:','http:'].includes(parsed.protocol))throw Error();setError('');setUrl(parsed.href);setMode('native')}catch{setError('Informe uma URL HTTP(S) válida para MP4 ou HLS (.m3u8).')}}
const nextSeason=available.find(s=>s.season_number>season);
const hasNext=type==='tv'&&(episode<(selected?.episode_count||1)||!!nextSeason);
function nextEpisode(){if(episode<(selected?.episode_count||1))setEpisode(e=>e+1);else if(nextSeason){setSeason(nextSeason.season_number);setEpisode(1)}setStarted(true);setEnded(false);}
const episodeCount=selected?.episode_count||1;
const episodePage=Math.floor((episode-1)/20);
return <section className="playerSection" id="assistir"><div className="player-heading"><h2>{type==='tv'?'Sua sessão':'Hora de assistir'}</h2><span>{type==='tv'?'T'+season+' · Episódio '+episode:'Prepare a pipoca'}</span></div>
<div className="videoFrame" id="player-frame">{!started?<div className="player-cover">{title.backdrop_path&&<img src={imageUrl(title.backdrop_path,'w780')} alt=""/>}<button type="button" aria-label={'Assistir '+title.title} onClick={()=>setStarted(true)}><Icon name="play" size={23}/></button><p>{type==='tv'?'Temporada '+season+' · Episódio '+episode:title.title}</p></div>:mode==='external'?popupMode==='filtered'&&(filterLoading||!filteredHtml)?<div className="player-error" role={filterError?'alert':'status'} data-player-error={filterDiagnostic||undefined}><p>{filterError||'Preparando sua sessão…'}</p>{filterError&&<><p>Tente outra opção em “Opções de reprodução”.</p><button className="button button-glass" onClick={()=>setReload(n=>n+1)}><Icon name="refresh" size={16}/>Tentar novamente</button></>}</div>:<iframe key={src+":"+popupMode+":"+reload} sandbox={popupMode==='compatible'?undefined:popupMode==='filtered'?FILTERED_SANDBOX:popupMode==='balanced'?"allow-scripts allow-same-origin allow-forms allow-presentation allow-downloads":"allow-scripts allow-same-origin allow-forms allow-presentation"} src={popupMode==='filtered'?undefined:src} srcDoc={popupMode==='filtered'?filteredHtml:undefined} title="Reprodutor SuperFlixAPI" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:url?<video ref={videoRef} controls playsInline onLoadedMetadata={e=>{if(resumeAt.current>0)e.currentTarget.currentTime=Math.min(resumeAt.current,Math.max(0,e.currentTarget.duration-10))}} onTimeUpdate={e=>{if(Date.now()-lastSave.current>5000){recordProgress(titleKey(title),season,episode,e.currentTarget.currentTime,e.currentTarget.duration);lastSave.current=Date.now()}}} onPause={e=>recordProgress(titleKey(title),season,episode,e.currentTarget.currentTime,e.currentTarget.duration)} onEnded={()=>setEnded(true)}/>:<div className="player-error"><p>Adicione um link direto nas opções de reprodução.</p></div>}</div>
{started&&<div className="player-controls">{type==='tv'&&<><button className="button button-glass" disabled={episode<=1} onClick={()=>{setEpisode(e=>Math.max(1,e-1));setEnded(false)}}><Icon name="back" size={16}/>Anterior</button><button className={'button '+(ended&&hasNext?'button-accent':'button-glass')} disabled={!hasNext} onClick={nextEpisode}><Icon name="next" size={16}/>Próximo</button></>}{nativeApp&&<button className="button button-glass pip-button" onClick={floatPlayer}><Icon name="pip" size={17}/>Janela flutuante</button>}<button className="icon-button" aria-label="Recarregar vídeo" title="Recarregar vídeo" onClick={()=>setReload(n=>n+1)}><Icon name="refresh" size={17}/></button></div>}
{notice&&<p className="player-notice" role="status">{notice}</p>}
{nativeApp&&started&&<p className="player-status"><i/>Reprodução protegida · use a janela flutuante para assistir em outros apps</p>}
{type==='tv'&&<><div className="selectors"><label>Temporada<select value={season} onChange={e=>{setSeason(Number(e.target.value));setEpisode(1);setEnded(false)}}>{(available.length?available:[{season_number:1,episode_count:1,name:'Temporada 1'}]).map(s=><option key={s.season_number} value={s.season_number}>{s.name||'Temporada '+s.season_number}</option>)}</select></label><label>Episódio<select value={episode} onChange={e=>{setEpisode(Number(e.target.value));setEnded(false)}}>{Array.from({length:episodeCount},(_,i)=><option key={i+1} value={i+1}>Episódio {i+1}</option>)}</select></label></div><div className="episode-list" role="group" aria-label="Escolher episódio">{Array.from({length:Math.min(20,episodeCount-episodePage*20)},(_,i)=>episodePage*20+i+1).map(n=><button key={n} aria-pressed={episode===n} className={episode===n?'selected':''} onClick={()=>{setEpisode(n);setStarted(true);setEnded(false)}}>{episode===n&&<Icon name="play" size={10}/>}E{n}</button>)}</div>{episodeCount>20&&<div className="episode-pagination"><button disabled={episodePage===0} onClick={()=>setEpisode(Math.max(1,(episodePage-1)*20+1))}>← Episódios anteriores</button><span>{episodePage*20+1}–{Math.min((episodePage+1)*20,episodeCount)}</span><button disabled={(episodePage+1)*20>=episodeCount} onClick={()=>setEpisode((episodePage+1)*20+1)}>Próximos episódios →</button></div>}</>}
{error&&<p className="player-notice" role="alert">{error}</p>}
{!nativeApp&&<details className="player-options"><summary>Opções de reprodução</summary><div><label>Proteção contra pop-ups<select value={popupMode} onChange={e=>setPopupMode(e.target.value as PopupMode)}><option value="filtered">Filtrado (experimental)</option><option value="balanced">Equilibrado</option><option value="strict">Rígido</option><option value="compatible">Compatibilidade (permite pop-ups)</option></select></label><button className="button button-glass" onClick={()=>{setMode(mode==='native'?'external':'native');setStarted(true)}}>{mode==='native'?'Voltar ao player externo':'Usar URL direta'}</button>{mode==='native'&&<div className="direct-row"><input className="direct-input" aria-label="URL direta de vídeo" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="URL MP4 ou HLS autorizada"/><button className="button button-light" onClick={playDirect}>Reproduzir</button></div>}<p className="playerNote">Alguns modos podem ser incompatíveis com o provedor. O aplicativo Android mantém a proteção de novas janelas.</p></div></details>}</section>;
}
