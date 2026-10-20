import {NextRequest,NextResponse} from 'next/server';
import {maskPhone,normalizePhone,validPassword} from '../../../lib/account';
import {SESSION_COOKIE,SESSION_DAYS,login,sessionPhone,sessionToken} from '../../../lib/account-store';
import {storeReady} from '../../../lib/ad-store';
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
// JSON only, so a cross-site form cannot post here without a CORS preflight.
const isJson=(req:NextRequest)=>(req.headers.get('content-type')||'').startsWith('application/json');
export async function GET(req:NextRequest){
 const phone=sessionPhone(req.cookies.get(SESSION_COOKIE)?.value);
 return json({phone:phone?maskPhone(phone):null});
}
export async function POST(req:NextRequest){
 if(!isJson(req))return json({error:'invalid'},415);
 if(!storeReady())return json({error:'unavailable'},503);
 const body=await req.json().catch(()=>null),phone=normalizePhone(body?.phone);
 if(!phone)return json({error:'phone'},400);
 if(!validPassword(body?.password))return json({error:'short'},400);
 let result;try{result=await login(phone,body.password)}catch{return json({error:'unavailable'},503)}
 if(!result.ok)return json({error:result.error},result.error==='limited'?429:401);
 const response=json({phone:maskPhone(phone),created:result.created});
 response.cookies.set(SESSION_COOKIE,sessionToken(phone),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:SESSION_DAYS*86400});
 return response;
}
export async function DELETE(){
 const response=json({phone:null});response.cookies.set(SESSION_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
 return response;
}
