import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {AD_EVENTS,DEFAULT_SETTINGS,cleanSettings,counts,dayKey,eventField,lastDays} from './ad-campaigns.ts';
import type {AdCounts,AdEvent,AdSettings,Campaign} from './ad-campaigns.ts';
// Upstash Redis over REST (Vercel Storage exposes KV_* names; Upstash direct uses UPSTASH_*).
const URL_=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL||'';
const TOKEN=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN||'';
export const storeReady=()=>!!(URL_&&TOKEN);
export const adminReady=()=>storeReady()&&(process.env.ADMIN_PASSWORD||'').length>=8;
type Command=(string|number)[];
async function pipeline(commands:Command[]):Promise<any[]>{
 if(!storeReady())throw Error('store_missing');
 const response=await fetch(URL_.replace(/\/$/,'')+'/pipeline',{method:'POST',headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},body:JSON.stringify(commands),cache:'no-store',signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('store_unavailable');
 const rows=await response.json() as {result?:any;error?:string}[];
 return rows.map(row=>{if(row.error)throw Error('store_error');return row.result;});
}
const hash=(row:any):Record<string,string>=>{const out:Record<string,string>={};if(Array.isArray(row))for(let i=0;i<row.length;i+=2)out[row[i]]=row[i+1];return out;};
const parse=<T>(raw:unknown):T|null=>{try{return typeof raw==='string'?JSON.parse(raw) as T:null}catch{return null}};

export async function listCampaigns():Promise<Campaign[]>{
 const [rows]=await pipeline([['HGETALL','ads:campaigns']]);
 return Object.values(hash(rows)).map(v=>parse<Campaign>(v)).filter((c):c is Campaign=>!!c).sort((a,b)=>b.createdAt-a.createdAt);
}
export async function saveCampaign(c:Campaign){await pipeline([['HSET','ads:campaigns',c.id,JSON.stringify(c)]]);}
export async function deleteCampaign(id:string){await pipeline([['HDEL','ads:campaigns',id]]);}
export async function getSettings():Promise<AdSettings>{const [raw]=await pipeline([['GET','ads:settings']]);return raw?cleanSettings(parse(raw)):DEFAULT_SETTINGS;}
export async function saveSettings(s:AdSettings){await pipeline([['SET','ads:settings',JSON.stringify(s)]]);}
export async function totalImpressions(ids:string[]):Promise<Record<string,number>>{
 if(!ids.length)return {};const rows=await pipeline(ids.map(id=>['HGET','ads:t:'+id,'impressions']));
 return Object.fromEntries(ids.map((id,i)=>[id,Number(rows[i])||0]));
}
export async function campaignStats(ids:string[],days=14):Promise<Record<string,{total:AdCounts;daily:{day:string;counts:AdCounts}[]}>>{
 if(!ids.length)return {};const range=lastDays(days);
 const rows=await pipeline(ids.flatMap(id=>[['HGETALL','ads:t:'+id],...range.map(day=>['HGETALL',`ads:d:${id}:${day}`])]));
 const out:Record<string,{total:AdCounts;daily:{day:string;counts:AdCounts}[]}>={};
 ids.forEach((id,i)=>{const base=i*(days+1);out[id]={total:counts(hash(rows[base])),daily:range.map((day,j)=>({day,counts:counts(hash(rows[base+1+j]))}))};});
 return out;
}

// View tokens make each counted event belong to one real ad delivery, once.
const secret=()=>createHash('sha256').update('flix-ads:'+(process.env.ADS_SECRET||TOKEN)).digest();
const sign=(value:string)=>createHmac('sha256',secret()).update(value).digest('base64url');
const same=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function viewToken(id:string,now=Date.now()){const body=`${id}.${now+2*3600000}.${randomBytes(9).toString('base64url')}`;return body+'.'+sign(body);}
export function readToken(token:string,now=Date.now()){
 const parts=token.split('.');if(parts.length!==4)return null;const body=parts.slice(0,3).join('.');
 if(!same(parts[3],sign(body))||Number(parts[1])<now)return null;return parts[0];
}
export async function recordEvent(token:string,event:AdEvent){
 const id=readToken(token);if(!id||!AD_EVENTS.includes(event))return false;
 const nonce=token.split('.')[2];
 // Only the first impression, first tap and first ending (complete/skip/error) of a delivery count.
 const slot=event==='impression'?'i':event==='click'?'c':'e';
 const [fresh]=await pipeline([['SET',`ads:seen:${nonce}:${slot}`,'1','NX','EX',7200]]);if(fresh!=='OK')return false;
 const field=eventField(event),day=dayKey();
 await pipeline([['HINCRBY','ads:t:'+id,field,1],['HINCRBY',`ads:d:${id}:${day}`,field,1],['EXPIRE',`ads:d:${id}:${day}`,400*86400]]);
 return true;
}

// Admin session: signed expiry cookie keyed by the admin password, so changing it logs everyone out.
const adminKey=()=>createHash('sha256').update('flix-admin:'+(process.env.ADMIN_PASSWORD||'')).digest();
const adminSign=(value:string)=>createHmac('sha256',adminKey()).update(value).digest('base64url');
export const ADMIN_COOKIE='flix_admin';
export function adminSession(now=Date.now()){const exp=String(now+7*86400000);return exp+'.'+adminSign(exp);}
export function validSession(value:string|undefined,now=Date.now()){
 if(!adminReady()||!value)return false;const [exp,sig]=value.split('.');
 return !!exp&&!!sig&&Number(exp)>now&&same(sig,adminSign(exp));
}
export function passwordMatches(input:string){
 const expected=process.env.ADMIN_PASSWORD||'';if(expected.length<8)return false;
 const a=createHash('sha256').update(input).digest(),b=createHash('sha256').update(expected).digest();return timingSafeEqual(a,b);
}
export async function loginAllowed(ip:string){
 const key='ads:login:'+createHash('sha256').update(ip).digest('hex').slice(0,24);
 const [tries]=await pipeline([['INCR',key],['EXPIRE',key,900,'NX']]);return Number(tries)<=10;
}
