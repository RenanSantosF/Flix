import {NextResponse} from 'next/server';
import {getLiveCatalog} from '../../../lib/superflix';
export async function GET(){const data=await getLiveCatalog();return NextResponse.json(data,{status:data.errors.channels&&data.errors.events?503:200,headers:{'Cache-Control':'no-store'}})}
