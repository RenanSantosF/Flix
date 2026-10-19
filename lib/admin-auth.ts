import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {ADMIN_COOKIE,validSession} from './ad-store';
export async function isAdmin(){return validSession((await cookies()).get(ADMIN_COOKIE)?.value);}
export const denied=()=>NextResponse.json({error:'Entre novamente no painel.'},{status:401});
