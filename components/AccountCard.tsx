'use client';
import {useEffect,useRef,useState} from 'react';
import Icon from './Icons';
import {formatPhone,normalizePhone} from '../lib/account';
import {currentAccount,signIn,signOut,startAccount} from '../lib/account-client';
import type {Account,LoginError} from '../lib/account-client';
const ERRORS:Record<LoginError,string>={
 phone:'Confira o número com DDD.',
 short:'A senha precisa ter pelo menos 4 caracteres.',
 password:'Senha incorreta para este número.',
 limited:'Muitas tentativas. Espere 15 minutos e tente de novo.',
 unavailable:'Sem conexão com o Flix agora. Tente de novo.',
};
export function useAccount(){
 const [account,setAccount]=useState<Account>(currentAccount);
 useEffect(()=>{startAccount();const update=()=>setAccount(currentAccount());update();addEventListener('flix:account',update);return()=>removeEventListener('flix:account',update)},[]);
 return account;
}
/** Starts background sync on every page. */
export function AccountSync(){useEffect(()=>startAccount(),[]);return null;}
export default function AccountCard(){
 const account=useAccount(),[open,setOpen]=useState(false),[welcome,setWelcome]=useState('');
 if(!account.ready)return null;
 if(account.phone)return <section className="account-card signed-in">
  <span className="account-icon"><Icon name="check" size={20}/></span>
  <div><strong>{welcome||'Sua lista está salva na conta'}</strong><span>{account.phone}{account.syncing?' · sincronizando…':' · em qualquer celular'}</span></div>
  <button type="button" className="account-out" onClick={()=>{setWelcome('');signOut()}}>Sair</button>
 </section>;
 return <>
  <button type="button" className="account-card" onClick={()=>setOpen(true)}>
   <span className="account-icon"><Icon name="plus" size={20}/></span>
   <div><strong>Leve sua lista para qualquer celular</strong><span>Entre com seu número. Sem código, sem e-mail.</span></div>
   <Icon name="chevron" size={18}/>
  </button>
  {open&&<LoginSheet onClose={()=>setOpen(false)} onDone={created=>{setOpen(false);setWelcome(created?'Conta criada. Sua lista agora vai com você':'Que bom te ver de novo')}}/>}
 </>;
}
function LoginSheet({onClose,onDone}:{onClose:()=>void;onDone:(created:boolean)=>void}){
 const [phone,setPhone]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),field=useRef<HTMLInputElement>(null);
 useEffect(()=>{field.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};addEventListener('keydown',key);return()=>removeEventListener('keydown',key)},[onClose]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(busy)return;
  if(!normalizePhone(phone)){setError(ERRORS.phone);return;}
  if(password.length<4){setError(ERRORS.short);return;}
  setBusy(true);setError('');
  const result=await signIn(phone,password);setBusy(false);
  if('error' in result)setError(ERRORS[result.error]);else onDone(result.created);
 };
 return <div className="update-overlay" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={busy?undefined:onClose}>
  <form className="update-sheet login-sheet" onClick={e=>e.stopPropagation()} onSubmit={submit} noValidate>
   <button type="button" className="login-close" aria-label="Fechar" onClick={onClose}><Icon name="close" size={18}/></button>
   <span className="wordmark">FLIX<span>·</span></span>
   <h2 id="login-title">Entrar no Flix</h2>
   <p>Primeira vez? A conta é criada na hora.</p>
   <label><span>Celular com DDD</span><input ref={field} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 91234-5678" value={phone} onChange={e=>{setPhone(formatPhone(e.target.value));setError('')}}/></label>
   <label><span>Senha</span><input type="password" autoComplete="current-password" placeholder="Mínimo 4 caracteres" maxLength={64} value={password} onChange={e=>{setPassword(e.target.value);setError('')}}/></label>
   {error&&<p className="login-error" role="alert">{error}</p>}
   <button type="submit" className="button button-light login-go" disabled={busy}>{busy?'Entrando…':'Entrar'}</button>
  </form>
 </div>;
}
