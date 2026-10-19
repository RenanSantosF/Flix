// Pure campaign rules shared by the ad API, the admin panel and tests.
export type CampaignKind='video'|'vast'|'poster';
export type AdSlot='preroll'|'live'|'poster';
export type Campaign={id:string;name:string;advertiser:string;kind:CampaignKind;url:string;message:string;weight:number;active:boolean;startsAt:string;endsAt:string;maxImpressions:number;skipAfter:number;cpm:number;createdAt:number};
export type AdSettings={enabled:boolean;liveEnabled:boolean;postersEnabled:boolean;minutesBetween:number;defaultSkip:number};
export type AdCounts={impressions:number;completes:number;skips:number;errors:number;clicks:number};
export const AD_EVENTS=['impression','complete','skip','error','click'] as const;
export type AdEvent=typeof AD_EVENTS[number];
export const DEFAULT_SETTINGS:AdSettings={enabled:true,liveEnabled:true,postersEnabled:true,minutesBetween:0,defaultSkip:5};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const int=(v:unknown,min:number,max:number,fallback:number)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;};
const str=(v:unknown,max:number)=>String(v??'').trim().slice(0,max);
export function emptyCounts():AdCounts{return {impressions:0,completes:0,skips:0,errors:0,clicks:0};}
// Dates are entered and reported in Brasília time, like the rest of the app.
export function dayKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function lastDays(count:number,now=new Date()){return Array.from({length:count},(_,i)=>dayKey(new Date(now.getTime()-(count-1-i)*86400000)));}
export function cleanSettings(input:any):AdSettings{
 return {enabled:input?.enabled!==false,liveEnabled:input?.liveEnabled!==false,postersEnabled:input?.postersEnabled!==false,minutesBetween:int(input?.minutesBetween,0,1440,0),defaultSkip:int(input?.defaultSkip,0,30,5)};
}
export function cleanCampaign(input:any,id:string,createdAt=Date.now()):Campaign|{error:string}{
 const kind:CampaignKind=input?.kind==='vast'||input?.kind==='poster'?input.kind:'video';
 const url=str(input?.url,2000);
 if(!str(input?.name,80))return {error:'Dê um nome para a campanha.'};
 if(!/^https:\/\/[^\s"'<>]+$/.test(url))return {error:kind==='vast'?'Cole o link VAST completo, começando com https://.':kind==='poster'?'Cole o link da imagem, começando com https://.':'Cole o link do vídeo MP4, começando com https://.'};
 const startsAt=str(input?.startsAt,10),endsAt=str(input?.endsAt,10);
 if((startsAt&&!DAY.test(startsAt))||(endsAt&&!DAY.test(endsAt)))return {error:'Datas inválidas.'};
 if(startsAt&&endsAt&&endsAt<startsAt)return {error:'A data final é anterior à inicial.'};
 const cpm=Math.max(0,Math.min(100000,Math.round(Number(input?.cpm||0)*100)/100))||0;
 return {id,name:str(input?.name,80),advertiser:str(input?.advertiser,80),kind,url,message:kind==='poster'?str(input?.message,160):'',weight:int(input?.weight,1,100,1),active:input?.active!==false,startsAt,endsAt,maxImpressions:int(input?.maxImpressions,0,1e9,0),skipAfter:int(input?.skipAfter,-1,30,-1),cpm,createdAt};
}
export function eligible(c:Campaign,impressions:number,today=dayKey()){
 return c.active&&(!c.startsAt||today>=c.startsAt)&&(!c.endsAt||today<=c.endsAt)&&(!c.maxImpressions||impressions<c.maxImpressions);
}
// Weighted draw: a campaign with weight 3 appears about three times as often as one with weight 1.
export function pickCampaign(list:Campaign[],impressions:Record<string,number>,today=dayKey(),random=Math.random){
 const pool=list.filter(c=>eligible(c,impressions[c.id]||0,today));
 const total=pool.reduce((sum,c)=>sum+c.weight,0);if(!total)return null;
 let ticket=random()*total;for(const c of pool){ticket-=c.weight;if(ticket<0)return c;}
 return pool[pool.length-1];
}
export function campaignStatus(c:Campaign,impressions:number,today=dayKey()){
 if(!c.active)return 'Pausada';if(c.startsAt&&today<c.startsAt)return 'Agendada';if(c.endsAt&&today>c.endsAt)return 'Encerrada';
 if(c.maxImpressions&&impressions>=c.maxImpressions)return 'Meta atingida';return 'No ar';
}
export function amountDue(impressions:number,cpm:number){return Math.round(impressions*cpm/10)/100;}
export function counts(raw:Record<string,string|number>|null|undefined):AdCounts{
 return {impressions:Number(raw?.impressions)||0,completes:Number(raw?.completes)||0,skips:Number(raw?.skips)||0,errors:Number(raw?.errors)||0,clicks:Number(raw?.clicks)||0};
}
export function eventField(event:AdEvent){return event==='impression'?'impressions':event==='complete'?'completes':event==='skip'?'skips':event==='click'?'clicks':'errors';}
// Pre-rolls (films and live) use video campaigns; poster slots use image campaigns.
export function slotCampaigns(list:Campaign[],slot:AdSlot){return list.filter(c=>slot==='poster'?c.kind==='poster':c.kind!=='poster');}
export function slotEnabled(settings:AdSettings,slot:AdSlot){return slot==='poster'?settings.postersEnabled:slot==='live'?settings.liveEnabled:settings.enabled;}
// Distinct weighted draws, so one page never shows the same sponsored poster twice.
export function pickSeveral(list:Campaign[],impressions:Record<string,number>,count:number,today=dayKey(),random=Math.random){
 const out:Campaign[]=[];let pool=list;
 while(out.length<count){const c=pickCampaign(pool,impressions,today,random);if(!c)break;out.push(c);pool=pool.filter(p=>p.id!==c.id);}
 return out;
}
