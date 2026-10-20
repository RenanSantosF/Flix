// Browser-side delivery events; sendBeacon survives navigation away from the page.
export function reportAd(token:string,event:string){
 const body=JSON.stringify({token,event});
 if(!navigator.sendBeacon?.('/api/ads/event',new Blob([body],{type:'application/json'})))fetch('/api/ads/event',{method:'POST',body,headers:{'Content-Type':'application/json'},keepalive:true}).catch(()=>{});
}
// Anonymous per-device id: counts a title once per device and day in the Top 10.
export function deviceId(){
 try{let id=localStorage.getItem('flix-device');if(!id||!/^[a-z0-9-]{16,64}$/i.test(id)){id=crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem('flix-device',id);}return id;}catch{return '';}
}
export function reportWatch(type:string,id:number){
 const device=deviceId();if(!device)return;
 fetch('/api/top/watch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,id,device}),keepalive:true}).catch(()=>{});
}
