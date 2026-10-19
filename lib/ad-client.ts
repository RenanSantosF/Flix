// Browser-side delivery events; sendBeacon survives navigation away from the page.
export function reportAd(token:string,event:string){
 const body=JSON.stringify({token,event});
 if(!navigator.sendBeacon?.('/api/ads/event',new Blob([body],{type:'application/json'})))fetch('/api/ads/event',{method:'POST',body,headers:{'Content-Type':'application/json'},keepalive:true}).catch(()=>{});
}
