import {NextRequest,NextResponse} from 'next/server';
import {cleanSettings} from '../../../../lib/ad-campaigns';
import {getSettings,saveSettings} from '../../../../lib/ad-store';
import {denied,isAdmin} from '../../../../lib/admin-auth';
export const dynamic='force-dynamic';
export async function GET() {if(!await isAdmin())return denied();try{return NextResponse.json(await getSettings())}catch{return NextResponse.json({error:'Banco de dados indisponível.'},{status:503})}}
export async function POST(req:NextRequest) {
 if(!await isAdmin())return denied();
 const settings=cleanSettings(await req.json().catch(()=>null));
 try{await saveSettings(settings);return NextResponse.json(settings)}catch{return NextResponse.json({error:'Não foi possível salvar agora.'},{status:503})}
}
