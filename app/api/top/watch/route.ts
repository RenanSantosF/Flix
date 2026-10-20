import {NextRequest,NextResponse} from 'next/server';
import {recordWatch} from '../../../../lib/top-store';
import {validDevice} from '../../../../lib/top-watch';
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null);
 const type=body?.type==='tv'?'tv':body?.type==='movie'?'movie':null,id=Number(body?.id);
 if(!type||!Number.isSafeInteger(id)||id<1||!validDevice(body?.device))return NextResponse.json({error:'invalid'},{status:400});
 try{await recordWatch(type,id,body.device)}catch{return new NextResponse(null,{status:503})}
 return new NextResponse(null,{status:204});
}
