import {NextResponse} from 'next/server';
import {APK_URL} from '../../lib/app-release';
export function GET(){return NextResponse.redirect(APK_URL,{status:302,headers:{'Cache-Control':'no-store'}});}
