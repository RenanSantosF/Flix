'use client';
import {STORAGE_KEY} from './watch-library';
import {EPISODES_KEY} from './episode-progress';
// Keeps "Minha lista", history and episode progress in the account; the device copy stays the source for the UI.
const SYNC_KEY='flix:sync:v1',PULL_EVERY=60000;
type SyncState={rev:number;dirty:boolean};
export type Account={phone:string|null;ready:boolean;syncing:boolean};
let account:Account={phone:null,ready:false,syncing:false},started=false,applying=false,timer=0,lastPull=0,edits=0,running:Promise<void>|null=null;
const emit=()=>window.dispatchEvent(new Event('flix:account'));
const set=(next:Partial<Account>)=>{account={...account,...next};emit();};
export const currentAccount=()=>account;
function readState():SyncState{try{const s=JSON.parse(localStorage.getItem(SYNC_KEY)||'{}');return {rev:Number.isSafeInteger(s.rev)?s.rev:0,dirty:s.dirty===true}}catch{return {rev:0,dirty:false}}}
const writeState=(s:SyncState)=>{try{localStorage.setItem(SYNC_KEY,JSON.stringify(s))}catch{}};
const raw=(key:string,fallback:string)=>{try{return localStorage.getItem(key)||fallback}catch{return fallback}};
async function syncNow(){
 if(!account.phone)return;
 const state=readState(),editsAtStart=edits;set({syncing:true});
 try{
  const body=state.dirty?{rev:state.rev,dirty:true,library:JSON.parse(raw(STORAGE_KEY,'{}')),episodes:JSON.parse(raw(EPISODES_KEY,'{}'))}:{rev:state.rev,dirty:false};
  const payload=JSON.stringify(body);
  // keepalive lets the last change leave while the app goes to the background (browsers cap it at 64 KB).
  const response=await fetch('/api/account/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:document.visibilityState==='hidden'&&payload.length<60000});
  if(response.status===401){set({phone:null});return;}
  if(!response.ok)return;
  const doc=await response.json();lastPull=Date.now();
  // A change made while the request was in flight stays dirty for the next round.
  const changed=edits!==editsAtStart;
  if(!changed){
   applying=true;
   try{
    const library=JSON.stringify(doc.library),episodes=JSON.stringify(doc.episodes);
    if(raw(STORAGE_KEY,'')!==library){localStorage.setItem(STORAGE_KEY,library);window.dispatchEvent(new Event('flix:library'));}
    if(raw(EPISODES_KEY,'')!==episodes){localStorage.setItem(EPISODES_KEY,episodes);window.dispatchEvent(new Event('flix:episodes'));}
   }catch{}finally{applying=false;}
  }
  // Unapplied server data keeps the old revision so the next push merges instead of replacing it.
  writeState(changed?{rev:state.rev,dirty:true}:{rev:doc.rev,dirty:false});
 }catch{}finally{set({syncing:false});}
}
function queue(){if(running)return running;running=syncNow().finally(()=>{running=null;if(readState().dirty&&account.phone)schedule(4000)});return running;}
function schedule(delay:number){clearTimeout(timer);timer=window.setTimeout(queue,delay);}
function changed(){if(applying||!account.phone)return;edits++;const s=readState();if(!s.dirty)writeState({...s,dirty:true});schedule(3000);}
export function startAccount(){
 if(started||typeof window==='undefined')return;started=true;
 addEventListener('flix:library',changed);addEventListener('flix:episodes',changed);
 document.addEventListener('visibilitychange',()=>{if(!account.phone)return;if(document.visibilityState==='hidden'&&readState().dirty)queue();else if(document.visibilityState==='visible'&&Date.now()-lastPull>PULL_EVERY)queue();});
 fetch('/api/account',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{set({phone:d?.phone||null,ready:true});if(d?.phone)queue();}).catch(()=>set({ready:true}));
}
export type LoginError='phone'|'short'|'password'|'limited'|'unavailable';
export async function signIn(phone:string,password:string):Promise<{created:boolean}|{error:LoginError}>{
 try{
  const response=await fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return {error:(['phone','short','password','limited'].includes(data.error)?data.error:'unavailable') as LoginError};
  // First sync on this device merges what is here with what the account already has.
  writeState({rev:0,dirty:true});set({phone:data.phone});await queue();
  return {created:data.created===true};
 }catch{return {error:'unavailable'};}
}
export async function signOut(){
 await queue();
 try{await fetch('/api/account',{method:'DELETE'})}catch{}
 writeState({rev:0,dirty:false});set({phone:null});
}
