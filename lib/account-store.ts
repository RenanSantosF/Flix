import {createHash,createHmac,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {pipeline} from './ad-store.ts';
import {nextDoc} from './account.ts';
import type {SyncDoc} from './account.ts';
export const SESSION_COOKIE='flix-account';
export const SESSION_DAYS=365;
const MAX_FAILS=10,FAIL_WINDOW=900;
const secret=()=>createHash('sha256').update('flix-account:'+(process.env.ADS_SECRET||process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN||'')).digest();
const derive=(password:string,salt:Buffer)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,32,(error,key)=>error?reject(error):resolve(key)));
async function hashPassword(password:string){const salt=randomBytes(16);return salt.toString('base64url')+'.'+(await derive(password,salt)).toString('base64url');}
async function checkPassword(password:string,stored:string){
 const [salt,hash]=stored.split('.');if(!salt||!hash)return false;
 const expected=Buffer.from(hash,'base64url'),actual=await derive(password,Buffer.from(salt,'base64url'));
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export type LoginResult={ok:true;created:boolean}|{ok:false;error:'password'|'limited'};
/** Unknown phone creates the account; a known one must match its password. */
export async function login(phone:string,password:string):Promise<LoginResult>{
 const failKey='acct:fail:'+phone,[fails,stored]=await pipeline([['GET',failKey],['HGET','acct:'+phone,'password']]);
 if(Number(fails)>=MAX_FAILS)return {ok:false,error:'limited'};
 if(!stored){
  const [created]=await pipeline([['HSETNX','acct:'+phone,'password',await hashPassword(password)],['HSETNX','acct:'+phone,'createdAt',Date.now()]]);
  if(created===1)return {ok:true,created:true};
  return login(phone,password);
 }
 if(await checkPassword(password,stored))return {ok:true,created:false};
 await pipeline([['INCR',failKey],['EXPIRE',failKey,FAIL_WINDOW]]);
 return {ok:false,error:'password'};
}
const sign=(value:string)=>createHmac('sha256',secret()).update(value).digest('base64url');
export function sessionToken(phone:string,now=Date.now()){const value=`${phone}.${now+SESSION_DAYS*86400000}`;return value+'.'+sign(value);}
export function sessionPhone(token:string|undefined,now=Date.now()):string|null{
 const [phone,expires,signature]=(token||'').split('.');if(!phone||!expires||!signature||!/^\d{10,11}$/.test(phone))return null;
 const expected=Buffer.from(sign(`${phone}.${expires}`)),actual=Buffer.from(signature);
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual)||!(Number(expires)>now))return null;
 return phone;
}
const EMPTY:SyncDoc={library:{favorites:[],history:[]},episodes:{},rev:0};
export async function sync(phone:string,body:{rev:number;dirty:boolean;library?:unknown;episodes?:unknown}):Promise<SyncDoc>{
 const key='acct:data:'+phone,[raw]=await pipeline([['GET',key]]);
 let stored:SyncDoc|null=null;try{stored=raw?JSON.parse(raw):null}catch{}
 const next=nextDoc(stored,body);
 if(!next)return stored||EMPTY;
 await pipeline([['SET',key,JSON.stringify(next)]]);
 return next;
}
