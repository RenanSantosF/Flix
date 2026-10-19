import {NextRequest,NextResponse} from 'next/server';
import {pickCampaign,pickSeveral,slotCampaigns,slotEnabled} from '../../../../lib/ad-campaigns';
import type {AdSlot} from '../../../../lib/ad-campaigns';
import {getSettings,listCampaigns,storeReady,totalImpressions,viewToken} from '../../../../lib/ad-store';
export const dynamic='force-dynamic';
const none=()=>new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});
// 204 means "no ad now": the player goes straight to the content and poster rails stay as they are.
export async function GET(req:NextRequest) {
 if(!storeReady())return none();
 const raw=req.nextUrl.searchParams.get('slot');
 const slot:AdSlot=raw==='live'||raw==='poster'?raw:'preroll';
 try{
  const [settings,all]=await Promise.all([getSettings(),listCampaigns()]);
  if(!slotEnabled(settings,slot))return none();
  const campaigns=slotCampaigns(all,slot);
  const impressions=await totalImpressions(campaigns.filter(c=>c.maxImpressions>0).map(c=>c.id));
  if(slot==='poster'){
   const count=Math.max(1,Math.min(4,Number(req.nextUrl.searchParams.get('count'))||3));
   const items=pickSeveral(campaigns,impressions,count).map(c=>({token:viewToken(c.id),image:c.url,name:c.name,advertiser:c.advertiser,message:c.message||''}));
   return items.length?NextResponse.json({items},{headers:{'Cache-Control':'no-store'}}):none();
  }
  const chosen=pickCampaign(campaigns,impressions);if(!chosen)return none();
  return NextResponse.json({token:viewToken(chosen.id),kind:chosen.kind,url:chosen.url,skipAfter:chosen.skipAfter>=0?chosen.skipAfter:settings.defaultSkip,useVastSkip:chosen.kind==='vast'&&chosen.skipAfter<0,minutesBetween:settings.minutesBetween},{headers:{'Cache-Control':'no-store'}});
 }catch{return none()}
}
