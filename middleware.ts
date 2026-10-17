import {NextRequest,NextResponse} from 'next/server';
import {verify} from './lib/auth';
export async function middleware(req:NextRequest){const p=req.nextUrl.pathname;if(p==='/login'||p==='/api/login'||p.startsWith('/_next/')||p==='/favicon.ico')return NextResponse.next();if(await verify(req.cookies.get('flix_session')?.value))return NextResponse.next();return NextResponse.redirect(new URL('/login',req.url))}
export const config={matcher:['/((?!_next/static|_next/image).*)']};
