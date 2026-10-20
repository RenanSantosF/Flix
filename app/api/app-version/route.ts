import {NextResponse} from 'next/server';
import {latestRelease} from '../../../lib/app-release';
export async function GET(){
 const release=await latestRelease();
 return release?NextResponse.json(release,{headers:{'Cache-Control':'public, max-age=120, s-maxage=300'}}):new NextResponse(null,{status:204});
}
