'use client';
import {useEffect,useMemo,useState} from 'react';
import {amountDue,campaignStatus,dayKey,emptyCounts} from '../lib/ad-campaigns';
import type {AdCounts,AdSettings,Campaign} from '../lib/ad-campaigns';
type Stats=Record<string,{total:AdCounts;daily:{day:string;counts:AdCounts}[]}>;
const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=(v:number)=>v.toLocaleString('pt-BR');
const pct=(part:number,whole:number)=>whole?Math.round(part/whole*100)+'%':'—';
const shortDay=(day:string)=>day.slice(8)+'/'+day.slice(5,7);
async function call(url:string,init?:RequestInit){
 const response=await fetch(url,{...init,headers:{'Content-Type':'application/json'},cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(response.status===401)location.reload();
 if(!response.ok)throw Error(data.error||'Algo deu errado. Tente de novo.');
 return data;
}
export function AdminLogin(){
 const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <form className="admin-card admin-login" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await call('/api/admin/login',{method:'POST',body:JSON.stringify({password})});location.reload()}catch(err){setError((err as Error).message);setBusy(false)}}}>
  <span className="eyebrow">PAINEL DE ANÚNCIOS</span><h1>Entrar</h1>
  <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
  {error&&<p className="admin-error" role="alert">{error}</p>}
  <button className="button button-light" disabled={busy}>{busy?'Entrando…':'Entrar'}</button>
 </form>;
}
const BLANK={name:'',advertiser:'',kind:'video',url:'',message:'',weight:1,active:true,startsAt:'',endsAt:'',maxImpressions:0,skipAfter:-1,cpm:0};
type Draft=typeof BLANK&{id?:string};
function CampaignForm({draft,onCancel,onSaved}:{draft:Draft;onCancel:()=>void;onSaved:()=>void}){
 const [form,setForm]=useState<Draft>(draft),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const set=(key:keyof Draft)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setForm(f=>({...f,[key]:e.target.type==='checkbox'?(e.target as HTMLInputElement).checked:e.target.value}));
 return <form className="admin-card admin-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await call('/api/admin/campaigns',{method:'POST',body:JSON.stringify(form)});onSaved()}catch(err){setError((err as Error).message);setBusy(false)}}}>
  <h2>{form.id?'Editar campanha':'Nova campanha'}</h2>
  <label>Nome da campanha<input value={form.name} onChange={set('name')} placeholder="Ex.: Pizzaria Bella — outubro" required maxLength={80}/></label>
  <label>Anunciante<input value={form.advertiser} onChange={set('advertiser')} placeholder="Quem paga (aparece no relatório)" maxLength={80}/></label>
  <label>Tipo<select value={form.kind} onChange={set('kind')}><option value="video">Vídeo próprio (link MP4)</option><option value="vast">Rede de anúncios (link VAST)</option><option value="poster">Capa patrocinada (imagem no catálogo)</option></select></label>
  <label>{form.kind==='vast'?'Link VAST da rede':form.kind==='poster'?'Link da imagem':'Link do vídeo MP4'}<input type="url" value={form.url} onChange={set('url')} placeholder="https://…" required/>
   <small>{form.kind==='vast'?'Copie da sua conta na rede (formato VAST / Video / Pre-roll).':form.kind==='poster'?'Imagem vertical 2:3 (ex.: 600×900, JPG ou PNG). Envie ao Vercel Blob e cole o link.':'Envie o vídeo ao Vercel Blob (Storage → Blob → Upload) e cole o link aqui. MP4 de até 30 s.'}</small></label>
  {form.kind==='poster'&&<label>Texto ao tocar na capa<textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} maxLength={160} rows={3} placeholder="Ex.: Peça pelo WhatsApp (11) 99999-0000 · 10% off com o código FLIX"/><small>Aparece quando a pessoa toca no anúncio. Até 160 caracteres.</small></label>}
  <div className="admin-grid">
   <label>Peso no sorteio<input type="number" min={1} max={100} value={form.weight} onChange={set('weight')}/><small>2 aparece o dobro de 1.</small></label>
   <label>Preço por mil (R$)<input type="number" min={0} step="0.01" value={form.cpm} onChange={set('cpm')}/><small>Usado no “a cobrar”. 0 = não cobrar.</small></label>
   <label>Início<input type="date" value={form.startsAt} onChange={set('startsAt')}/><small>Vazio = já.</small></label>
   <label>Fim<input type="date" value={form.endsAt} onChange={set('endsAt')}/><small>Vazio = sem fim.</small></label>
   <label>Limite de exibições<input type="number" min={0} value={form.maxImpressions} onChange={set('maxImpressions')}/><small>0 = sem limite. Para ao atingir.</small></label>
   {form.kind!=='poster'&&<label>Pular após (s)<input type="number" min={-1} max={30} value={form.skipAfter} onChange={set('skipAfter')}/><small>-1 = padrão dos ajustes.</small></label>}
  </div>
  <label className="admin-check"><input type="checkbox" checked={form.active} onChange={set('active')}/>Campanha ativa</label>
  {error&&<p className="admin-error" role="alert">{error}</p>}
  <div className="admin-actions"><button type="button" className="button button-glass" onClick={onCancel}>Cancelar</button><button className="button button-light" disabled={busy}>{busy?'Salvando…':'Salvar'}</button></div>
 </form>;
}
function DailyBars({daily}:{daily:{day:string;counts:AdCounts}[]}){
 const max=Math.max(1,...daily.map(d=>d.counts.impressions));
 return <figure className="admin-bars"><figcaption>Exibições por dia · últimos 14 dias</figcaption>
  <div className="admin-bars-plot" role="img" aria-label={daily.map(d=>`${shortDay(d.day)}: ${d.counts.impressions}`).join(', ')}>
   {daily.map(d=><div key={d.day} className="admin-bar" tabIndex={0} data-tip={`${shortDay(d.day)} · ${num(d.counts.impressions)} exibições · ${num(d.counts.completes)} até o fim`}><i style={{height:(d.counts.impressions/max*100)+'%'}}/></div>)}
  </div>
  <div className="admin-bars-axis"><span>{shortDay(daily[0]?.day||'')}</span><span>máx. {num(max)}/dia</span><span>{shortDay(daily[daily.length-1]?.day||'')}</span></div>
 </figure>;
}
function report(c:Campaign,s:{total:AdCounts;daily:{day:string;counts:AdCounts}[]}){
 const t=s.total;return [`Relatório Flix — ${c.name}`,c.advertiser&&`Anunciante: ${c.advertiser}`,`Período: ${c.startsAt||'início'} a ${c.endsAt||'hoje'}`,`Exibições: ${num(t.impressions)}`,...(c.kind==='poster'?[`Toques no anúncio: ${num(t.clicks)} (${pct(t.clicks,t.impressions)})`]:[`Assistidos até o fim: ${num(t.completes)} (${pct(t.completes,t.impressions)})`,`Pulados: ${num(t.skips)}`]),c.cpm>0&&`Valor: ${money(amountDue(t.impressions,c.cpm))} (${money(c.cpm)} por mil)`,'',...s.daily.filter(d=>d.counts.impressions).map(d=>`${shortDay(d.day)}: ${num(d.counts.impressions)}`)].filter(v=>v!==false&&v!=='').join('\n');
}
export default function AdminPanel(){
 const [campaigns,setCampaigns]=useState<Campaign[]>([]),[stats,setStats]=useState<Stats>({}),[settings,setSettings]=useState<AdSettings|null>(null);
 const [tab,setTab]=useState<'summary'|'campaigns'|'settings'>('summary'),[draft,setDraft]=useState<Draft|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true);
 async function load(){try{const [c,s]=await Promise.all([call('/api/admin/campaigns'),call('/api/admin/settings')]);setCampaigns(c.campaigns);setStats(c.stats);setSettings(s);setError('')}catch(err){setError((err as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 const today=dayKey();
 const sum=useMemo(()=>{
  const daily=(Object.values(stats)[0]?.daily||[]).map(d=>({day:d.day,counts:emptyCounts()}));
  const total=emptyCounts();let due=0;
  for(const c of campaigns){const s=stats[c.id];if(!s)continue;(Object.keys(total) as (keyof AdCounts)[]).forEach(k=>total[k]+=s.total[k]);due+=amountDue(s.total.impressions,c.cpm);s.daily.forEach((d,i)=>{if(daily[i])(Object.keys(total) as (keyof AdCounts)[]).forEach(k=>daily[i].counts[k]+=d.counts[k])});}
  return {total,daily,due,today:daily.find(d=>d.day===today)?.counts.impressions||0,week:daily.slice(-7).reduce((n,d)=>n+d.counts.impressions,0),live:campaigns.filter(c=>campaignStatus(c,stats[c.id]?.total.impressions||0,today)==='No ar')};
 },[campaigns,stats,today]);
 const weights=sum.live.reduce((n,c)=>n+c.weight,0);
 async function toggle(c:Campaign){await call('/api/admin/campaigns',{method:'POST',body:JSON.stringify({...c,active:!c.active})}).catch(err=>setError(err.message));load();}
 async function remove(c:Campaign){if(!confirm(`Excluir “${c.name}”? Os números dela deixam de aparecer no painel.`))return;await call('/api/admin/campaigns?id='+encodeURIComponent(c.id),{method:'DELETE'}).catch(err=>setError(err.message));load();}
 async function copy(c:Campaign){const s=stats[c.id];if(!s)return;try{await navigator.clipboard.writeText(report(c,s));setNotice('Relatório copiado. Cole no WhatsApp ou e-mail do anunciante.')}catch{setNotice('Não foi possível copiar neste navegador.')}setTimeout(()=>setNotice(''),4000);}
 return <div className="admin-shell">
  <header className="admin-head"><div><span className="eyebrow">FLIX</span><h1>Anúncios</h1></div><button className="button button-glass" onClick={async()=>{await fetch('/api/admin/login',{method:'DELETE'});location.reload()}}>Sair</button></header>
  <nav className="admin-tabs" aria-label="Seções">{([['summary','Resumo'],['campaigns','Campanhas'],['settings','Ajustes']] as const).map(([key,label])=><button key={key} aria-pressed={tab===key} className={tab===key?'selected':''} onClick={()=>{setTab(key);setDraft(null)}}>{label}</button>)}</nav>
  {error&&<p className="admin-error" role="alert">{error}</p>}{notice&&<p className="admin-notice" role="status">{notice}</p>}
  {loading?<p className="admin-muted">Carregando…</p>:<>
  {tab==='summary'&&<section className="admin-section">
   {settings&&!settings.enabled&&!settings.liveEnabled&&!settings.postersEnabled&&<p className="admin-warning">Anúncios desligados em Ajustes. Ninguém está vendo anúncios agora.</p>}
   <div className="admin-tiles"><div className="admin-tile"><span>Hoje</span><strong>{num(sum.today)}</strong><small>exibições</small></div><div className="admin-tile"><span>7 dias</span><strong>{num(sum.week)}</strong><small>exibições</small></div><div className="admin-tile"><span>Total</span><strong>{num(sum.total.impressions)}</strong><small>{pct(sum.total.completes,sum.total.impressions)} até o fim</small></div><div className="admin-tile"><span>A cobrar</span><strong>{money(sum.due)}</strong><small>campanhas próprias</small></div></div>
   {sum.daily.length>0&&<div className="admin-card"><DailyBars daily={sum.daily}/></div>}
   <div className="admin-card"><h2>No ar agora · {sum.live.length}</h2>{sum.live.length?<ul className="admin-share">{sum.live.map(c=><li key={c.id}><span>{c.name}</span><strong>{pct(c.weight,weights)}</strong></li>)}</ul>:<p className="admin-muted">Nenhuma campanha no ar. Os vídeos começam direto, sem anúncio.</p>}</div>
  </section>}
  {tab==='campaigns'&&<section className="admin-section">
   {draft?<CampaignForm draft={draft} onCancel={()=>setDraft(null)} onSaved={()=>{setDraft(null);load()}}/>:<button className="button button-light admin-new" onClick={()=>setDraft({...BLANK})}>+ Nova campanha</button>}
   {!draft&&campaigns.length===0&&<p className="admin-muted">Nenhuma campanha ainda. Toque em “Nova campanha”.</p>}
   {!draft&&campaigns.map(c=>{const s=stats[c.id]?.total||emptyCounts(),status=campaignStatus(c,s.impressions,today);return <article key={c.id} className="admin-card admin-campaign">
    <div className="admin-campaign-head"><div><h3>{c.name}</h3><p>{[c.advertiser,c.kind==='vast'?'Rede (VAST)':c.kind==='poster'?'Capa patrocinada':'Vídeo próprio',`peso ${c.weight}`].filter(Boolean).join(' · ')}</p></div><span className={'admin-pill'+(status==='No ar'?' live':'')}>{status}</span></div>
    <dl className="admin-stats"><div><dt>Exibições</dt><dd>{num(s.impressions)}</dd></div>{c.kind==='poster'?<><div><dt>Toques</dt><dd>{num(s.clicks)}</dd></div><div><dt>Taxa</dt><dd>{pct(s.clicks,s.impressions)}</dd></div></>:<><div><dt>Até o fim</dt><dd>{pct(s.completes,s.impressions)}</dd></div><div><dt>Pulados</dt><dd>{num(s.skips)}</dd></div></>}<div><dt>A cobrar</dt><dd>{c.cpm>0?money(amountDue(s.impressions,c.cpm)):'—'}</dd></div></dl>
    {c.maxImpressions>0&&<div className="admin-progress" aria-label={`${s.impressions} de ${c.maxImpressions} exibições`}><i style={{width:Math.min(100,s.impressions/c.maxImpressions*100)+'%'}}/><span>{num(s.impressions)} de {num(c.maxImpressions)}</span></div>}
    {(c.startsAt||c.endsAt)&&<p className="admin-muted">{c.startsAt?shortDay(c.startsAt)+'/'+c.startsAt.slice(0,4):'Já'} até {c.endsAt?shortDay(c.endsAt)+'/'+c.endsAt.slice(0,4):'sem fim'}</p>}
    <div className="admin-actions"><button className="button button-glass" onClick={()=>setDraft({...c})}>Editar</button><button className="button button-glass" onClick={()=>toggle(c)}>{c.active?'Pausar':'Ativar'}</button><button className="button button-glass" onClick={()=>copy(c)}>Copiar relatório</button><button className="button button-glass admin-danger" onClick={()=>remove(c)}>Excluir</button></div>
   </article>})}
  </section>}
  {tab==='settings'&&settings&&<form className="admin-card admin-form" onSubmit={async e=>{e.preventDefault();try{setSettings(await call('/api/admin/settings',{method:'POST',body:JSON.stringify(settings)}));setNotice('Ajustes salvos.');setTimeout(()=>setNotice(''),3000)}catch(err){setError((err as Error).message)}}}>
   <h2>Ajustes gerais</h2>
   <label className="admin-check"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/>Vídeo antes de filmes e séries</label>
   <label className="admin-check"><input type="checkbox" checked={settings.liveEnabled} onChange={e=>setSettings({...settings,liveEnabled:e.target.checked})}/>Vídeo antes das transmissões ao vivo</label>
   <label className="admin-check"><input type="checkbox" checked={settings.postersEnabled} onChange={e=>setSettings({...settings,postersEnabled:e.target.checked})}/>Capas patrocinadas no catálogo</label>
   <label>Intervalo mínimo entre vídeos de anúncio (minutos)<input type="number" min={0} max={1440} value={settings.minutesBetween} onChange={e=>setSettings({...settings,minutesBetween:Number(e.target.value)})}/><small>Quem acabou de ver um anúncio não vê outro antes disso. 0 = a cada vídeo aberto.</small></label>
   <label>Pular liberado após (segundos)<input type="number" min={0} max={30} value={settings.defaultSkip} onChange={e=>setSettings({...settings,defaultSkip:Number(e.target.value)})}/><small>Padrão das campanhas com “-1”. 0 = pular imediatamente.</small></label>
   <div className="admin-actions"><button className="button button-light">Salvar ajustes</button></div>
  </form>}
  </>}
 </div>;
}
