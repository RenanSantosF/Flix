'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Hls from 'hls.js';
import {FILTERED_SANDBOX, loadBrowserPlayer, readPlayerHtml} from '../lib/filtered-player';
type PopupMode='filtered'|'balanced'|'strict'|'compatible';
type Season={season_number:number;episode_count:number;name:string};
export default function Player({type,id,seasons}:{type:'movie'|'tv';id:string;seasons:Season[]}){
const available=seasons.filter(s=>s.season_number>=0&&s.episode_count>0);
const first=available.find(s=>s.season_number===1)||available.find(s=>s.season_number>0)||available[0];
const [season,setSeason]=useState(first?.season_number??1);
const [episode,setEpisode]=useState(1);
const [mode,setMode]=useState<'external'|'native'>('external');
const [popupMode,setPopupMode]=useState<PopupMode>('filtered');
const [draft,setDraft]=useState('');
const [url,setUrl]=useState('');
const [error,setError]=useState('');
const [filteredHtml,setFilteredHtml]=useState('');
const [filterLoading,setFilterLoading]=useState(true);
const [filterError,setFilterError]=useState('');
const [filterDiagnostic,setFilterDiagnostic]=useState('');
const videoRef=useRef<HTMLVideoElement>(null);
const selected=available.find(s=>s.season_number===season);
const src=useMemo(()=>type==='movie'?'https://superflixapi.fun/filme/'+encodeURIComponent(id)+'#noLink':'https://superflixapi.fun/serie/'+encodeURIComponent(id)+'/'+season+'/'+episode+'#noEpList',[type,id,season,episode]);
const filteredSrc=useMemo(()=>{const original=new URL(src);return '/api/player/filter?path='+encodeURIComponent(original.pathname+original.search)+original.hash},[src]);
useEffect(()=>{setUrl('');setDraft('');setError('');setMode('external')},[type,id,season,episode]);
useEffect(()=>{
if(mode!=='external'||popupMode!=='filtered')return;
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
},[mode,popupMode,src,filteredSrc]);
useEffect(()=>{
if(mode!=='native'||!url||!videoRef.current)return;
const video=videoRef.current;
let hls:Hls|null=null;
const onError=()=>setError('Não foi possível reproduzir. Verifique a URL, o formato e a permissão CORS do servidor.');
video.addEventListener('error',onError);
if(/\.m3u8(?:[?#]|$)/i.test(url)&&Hls.isSupported()){
hls=new Hls({enableWorker:true});
hls.loadSource(url);
hls.attachMedia(video);
hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)setError('Falha no streaming HLS. A origem pode exigir autenticação ou bloquear CORS.')});
}else{video.src=url;video.load()}
return()=>{video.removeEventListener('error',onError);hls?.destroy();video.removeAttribute('src');video.load()}
},[mode,url]);
function playDirect(){try{const parsed=new URL(draft.trim());if(!['https:','http:'].includes(parsed.protocol))throw Error();setError('');setUrl(parsed.href);setMode('native')}catch{setError('Informe uma URL HTTP(S) válida para MP4 ou HLS (.m3u8).')}}
return <section className="playerSection"><h2>Assistir agora</h2>{type==='tv'&&<div className="selectors"><label>Temporada <select value={season} onChange={e=>{setSeason(Number(e.target.value));setEpisode(1)}}>{available.map(s=><option key={s.season_number} value={s.season_number}>{s.name||'Temporada '+s.season_number}</option>)}</select></label><label>Episódio <select value={episode} onChange={e=>setEpisode(Number(e.target.value))}>{Array.from({length:selected?.episode_count||1},(_,i)=><option key={i+1} value={i+1}>Episódio {i+1}</option>)}</select></label></div>}
<div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'16px 0'}}><button type="button" onClick={()=>{setMode('external');setError('')}}>Player externo</button><button type="button" onClick={()=>{setMode('native');setError('')}}>Player próprio (teste)</button></div>
{mode==='external'&&<label style={{display:'grid',gap:8,margin:'10px 0 16px'}}>Proteção contra pop-ups<select value={popupMode} onChange={e=>setPopupMode(e.target.value as PopupMode)} style={{background:'#161e2b',color:'#fff',border:'1px solid #394252',borderRadius:8,padding:12}}><option value="filtered">Filtrado (experimental)</option><option value="balanced">Equilibrado (teste)</option><option value="strict">Rígido (teste anterior)</option><option value="compatible">Compatibilidade (sem bloqueio)</option></select></label>}
{mode==='native'&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}><input aria-label="URL direta do vídeo" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Cole uma URL MP4 ou .m3u8 autorizada" style={{flex:'1 1 260px',minWidth:0,padding:12,borderRadius:8,background:'#151b25',border:'1px solid #555',color:'white'}}/><button type="button" onClick={playDirect}>Reproduzir URL</button></div>}
<div className="videoFrame">{mode==='external'?popupMode==='filtered'&&(filterLoading||!filteredHtml)?<div role={filterError?'alert':'status'} data-player-error={filterDiagnostic||undefined} style={{display:'grid',placeItems:'center',height:'100%',padding:24,textAlign:'center'}}><div><p>{filterError||'Preparando o player protegido…'}</p>{filterError&&<p>Você pode selecionar outra opção em Proteção contra pop-ups, acima do vídeo.</p>}</div></div>:<iframe key={src+":"+popupMode} sandbox={popupMode==='compatible'?undefined:popupMode==='filtered'?FILTERED_SANDBOX:popupMode==='balanced'?"allow-scripts allow-same-origin allow-forms allow-presentation allow-downloads":"allow-scripts allow-same-origin allow-forms allow-presentation"} src={popupMode==='filtered'?undefined:src} srcDoc={popupMode==='filtered'?filteredHtml:undefined} title="Reprodutor SuperFlixAPI" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy"/>:url?<video ref={videoRef} controls playsInline style={{width:'100%',height:'100%',background:'#000'}}/>:<div style={{display:'grid',placeItems:'center',height:'100%',padding:20,textAlign:'center'}}>Insira uma URL direta de vídeo para testar o player próprio.</div>}</div>
{error&&<p role="alert" style={{color:'#ff9e9e'}}>{error}</p>}
<p className="playerNote">{mode==='external'?(popupMode==='filtered'?'Modo experimental: filtra scripts de publicidade antes de carregar o player e mantém o bloqueio de novas abas. Se não carregar, selecione outra opção.':popupMode==='balanced'?'Teste intermediário: bloqueia novas janelas, mas permite downloads. Pode apresentar 404 se o provedor exigir navegação externa.':popupMode==='strict'?'Bloqueio rígido: impede pop-ups, mas anteriormente causou 404.':'Modo de compatibilidade: permite o player sem restrições adicionais, inclusive pop-ups.'):'O player próprio não extrai vídeos do iframe. Links podem falhar por CORS, autenticação ou expiração.'}</p></section>
}
