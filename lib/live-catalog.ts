export const SUPERFLIX_ORIGIN='https://superflixapi.fun';
export type LiveItem={id:string;kind:'channel'|'event';name:string;image:string;category:string;sport:string;competition:string;status:'live'|'upcoming'|'ended'|'unknown';startsAt:string;timeLabel:string;dateKey:string;playUrl:string;pageUrl:string;channels:string[]};
export type LiveCatalog={channels:LiveItem[];events:LiveItem[];errors:{channels?:string;events?:string};updatedAt:string};
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const str=(...values:unknown[])=>{for(const v of values)if(typeof v==='string'||typeof v==='number'){const s=String(v).trim();if(s)return s.slice(0,400)}return ''};
export function providerUrl(value:unknown):string {
 if(typeof value!=='string'||!value.trim()||value.length>2000)return '';
 try{const u=new URL(value,SUPERFLIX_ORIGIN);return u.origin===SUPERFLIX_ORIGIN&&!u.username&&!u.password?u.href:''}catch{return ''}
}
function imageUrl(value:unknown):string {if(typeof value!=='string'||value.length>2000)return '';try{const u=new URL(value,SUPERFLIX_ORIGIN);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
export function liveRows(value:unknown,kind:'channel'|'event'):unknown[] {
 if(Array.isArray(value))return value.slice(0,1500);
 const v=row(value),keys=kind==='channel'?['channels','canais','results','items','data']:['events','eventos','results','items','data'];
 for(const key of keys){if(Array.isArray(v[key]))return (v[key] as unknown[]).slice(0,1500);if(v[key]&&typeof v[key]==='object'){const child=liveRows(v[key],kind);if(child.length)return child}}
 return [];
}
export function liveStatus(value:unknown):LiveItem['status'] {
 const s=str(value).toLowerCase().replace(/[ _-]/g,'');
 if(['live','aovivo','inprogress','ongoing','playing','em andamento'.replace(/ /g,'')].includes(s))return 'live';
 if(['ended','finished','finalizado','encerrado','completed','ft'].includes(s))return 'ended';
 if(['upcoming','scheduled','agendado','notstarted','soon'].includes(s))return 'upcoming';return 'unknown';
}
export function normalizeLive(value:unknown,kind:'channel'|'event'):LiveItem|null {
 const v=row(value);if(v.is_active===false)return null;const name=str(v.name,v.title,v.nome,v.event_name,v.channel_name);if(!name)return null;
 const playUrl=providerUrl(kind==='event'?str(v.play_event_url,v.play_url,v.player_url,v.embed_url):str(v.play_url,v.player_url,v.embed_url,v.iframe_url));
 const pageUrl=providerUrl(str(v.page_url,v.url,v.link));
 // Never invent playback endpoints. A missing play URL uses the provider's returned page.
 const target=playUrl||pageUrl;
 if(!target)return null;
 const rawId=str(v.slug,v.id,v.channel_id,v.event_id)||new URL(target).pathname;
 const id=rawId.toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,100);if(!id)return null;
 const cat=row(v.category),competition=row(v.competition),sport=row(v.sport);
 const category=str(cat.name,cat.title,v.category_name,v.genre,v.categoria,typeof v.category==='string'?v.category:'');
 const date=str(v.start_at,v.starts_at,v.start_time,v.start_datetime,v.datetime,v.date_time,v.date);
 // Dates without an offset stay as provider text: do not guess a timezone.
 const startsAt=/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(Z|[+-]\d\d:?\d\d)$/.test(date)&&Number.isFinite(Date.parse(date))?new Date(date).toISOString():'';
 const linked=Array.isArray(v.channels)?v.channels:Array.isArray(v.embeds)?v.embeds:[];
 const channels=linked.map(c=>typeof c==='string'?c:str(row(c).name,row(c).provider,row(c).title)).filter(Boolean).slice(0,20);
 return {id,kind,name,image:imageUrl(str(v.event_logo,v.logo_url,v.logo,v.image,v.poster,v.thumbnail)),category,sport:str(sport.name,typeof v.sport==='string'?v.sport:'',v.sport_name,category,v.sport_key),competition:str(competition.name,typeof v.competition==='string'?v.competition:'',v.league),status:liveStatus(v.status),startsAt,dateKey:/^\d{4}-\d\d-\d\d/.test(date)?date.slice(0,10):'',timeLabel:startsAt?'':str(v.time,v.horario,date),playUrl:target,pageUrl,channels};
}
export function normalizeLiveList(value:unknown,kind:'channel'|'event'):LiveItem[]{const seen=new Set<string>();return liveRows(value,kind).map(v=>normalizeLive(v,kind)).filter((v):v is LiveItem=>{if(!v||seen.has(v.id))return false;seen.add(v.id);return true})}
export function liveTime(item:LiveItem){if(!item.startsAt&&/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(item.timeLabel)){const s=item.timeLabel;return s.slice(8,10)+'/'+s.slice(5,7)+' · '+s.slice(11,16)}return item.startsAt?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(item.startsAt)):item.timeLabel||'Horário a confirmar'}
