import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {cleanCampaign} from '../../../../lib/ad-campaigns';
import {campaignStats,deleteCampaign,listCampaigns,saveCampaign} from '../../../../lib/ad-store';
import {denied,isAdmin} from '../../../../lib/admin-auth';
export const dynamic='force-dynamic';
export async function GET() {
 if(!await isAdmin())return denied();
 try{const campaigns=await listCampaigns();return NextResponse.json({campaigns,stats:await campaignStats(campaigns.map(c=>c.id))});}
 catch{return NextResponse.json({error:'Banco de dados indisponível.'},{status:503})}
}
export async function POST(req:NextRequest) {
 if(!await isAdmin())return denied();
 const body=await req.json().catch(()=>null);
 try{
  const existing=typeof body?.id==='string'?(await listCampaigns()).find(c=>c.id===body.id):undefined;
  if(body?.id&&!existing)return NextResponse.json({error:'Campanha não encontrada.'},{status:404});
  const campaign=cleanCampaign(body,existing?.id||randomUUID().slice(0,8),existing?.createdAt);
  if('error' in campaign)return NextResponse.json(campaign,{status:400});
  await saveCampaign(campaign);return NextResponse.json({campaign});
 }catch{return NextResponse.json({error:'Não foi possível salvar agora.'},{status:503})}
}
export async function DELETE(req:NextRequest) {
 if(!await isAdmin())return denied();
 const id=(req.nextUrl.searchParams.get('id')||'').slice(0,40);if(!id)return NextResponse.json({error:'invalid'},{status:400});
 try{await deleteCampaign(id);return NextResponse.json({ok:true})}catch{return NextResponse.json({error:'Não foi possível excluir agora.'},{status:503})}
}
