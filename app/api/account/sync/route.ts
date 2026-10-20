import {NextRequest,NextResponse} from 'next/server';
import {SESSION_COOKIE,sessionPhone,sync} from '../../../../lib/account-store';
const MAX_BODY=400_000;
export async function POST(req:NextRequest){
 const phone=sessionPhone(req.cookies.get(SESSION_COOKIE)?.value);
 if(!phone)return NextResponse.json({error:'signed_out'},{status:401});
 if(!(req.headers.get('content-type')||'').startsWith('application/json'))return NextResponse.json({error:'invalid'},{status:415});
 const text=await req.text();if(text.length>MAX_BODY)return NextResponse.json({error:'too_large'},{status:413});
 let body:any;try{body=JSON.parse(text)}catch{return NextResponse.json({error:'invalid'},{status:400})}
 const rev=Number.isSafeInteger(body?.rev)&&body.rev>=0?body.rev:0;
 try{return NextResponse.json(await sync(phone,{rev,dirty:body?.dirty===true,library:body?.library,episodes:body?.episodes}),{headers:{'Cache-Control':'no-store'}})}
 catch{return new NextResponse(null,{status:503})}
}
