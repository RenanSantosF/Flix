import {NextRequest,NextResponse} from 'next/server';
import {ADMIN_COOKIE,adminReady,adminSession,loginAllowed,passwordMatches} from '../../../../lib/ad-store';
export async function POST(req:NextRequest) {
 if(!adminReady())return NextResponse.json({error:'Painel ainda não configurado.'},{status:503});
 const ip=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim()||'unknown';
 if(!await loginAllowed(ip).catch(()=>false))return NextResponse.json({error:'Muitas tentativas. Aguarde 15 minutos.'},{status:429});
 const body=await req.json().catch(()=>null);
 if(!passwordMatches(String(body?.password||'').slice(0,200)))return NextResponse.json({error:'Senha incorreta.'},{status:401});
 const response=NextResponse.json({ok:true});
 response.cookies.set(ADMIN_COOKIE,adminSession(),{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:7*86400});
 return response;
}
export async function DELETE() {const response=NextResponse.json({ok:true});response.cookies.delete(ADMIN_COOKIE);return response;}
