import {NextRequest,NextResponse} from 'next/server';
import {AD_EVENTS} from '../../../../lib/ad-campaigns';
import type {AdEvent} from '../../../../lib/ad-campaigns';
import {recordEvent,storeReady} from '../../../../lib/ad-store';
export async function POST(req:NextRequest) {
 if(!storeReady())return new NextResponse(null,{status:204});
 const body=await req.json().catch(()=>null);
 const token=typeof body?.token==='string'?body.token.slice(0,300):'',event=body?.event as AdEvent;
 if(!token||!AD_EVENTS.includes(event))return NextResponse.json({error:'invalid'},{status:400});
 try{await recordEvent(token,event)}catch{return new NextResponse(null,{status:503})}
 return new NextResponse(null,{status:204});
}
