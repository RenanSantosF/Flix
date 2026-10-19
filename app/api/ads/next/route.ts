import {NextResponse} from 'next/server';
import {pickCampaign} from '../../../../lib/ad-campaigns';
import {getSettings,listCampaigns,storeReady,totalImpressions,viewToken} from '../../../../lib/ad-store';
export const dynamic='force-dynamic';
// 204 means "no ad now": the player goes straight to the content.
export async function GET() {
 if(!storeReady())return new NextResponse(null,{status:204});
 try{
  const [settings,campaigns]=await Promise.all([getSettings(),listCampaigns()]);
  if(!settings.enabled)return new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});
  const capped=campaigns.filter(c=>c.maxImpressions>0);
  const chosen=pickCampaign(campaigns,await totalImpressions(capped.map(c=>c.id)));
  if(!chosen)return new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});
  return NextResponse.json({token:viewToken(chosen.id),kind:chosen.kind,url:chosen.url,skipAfter:chosen.skipAfter>=0?chosen.skipAfter:settings.defaultSkip,useVastSkip:chosen.kind==='vast'&&chosen.skipAfter<0,minutesBetween:settings.minutesBetween},{headers:{'Cache-Control':'no-store'}});
 }catch{return new NextResponse(null,{status:204})}
}
