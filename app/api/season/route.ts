import {NextRequest,NextResponse} from 'next/server';
import {tmdb} from '../../../lib/catalog';
export async function GET(req:NextRequest) {
 const id=Number(req.nextUrl.searchParams.get('id')),season=Number(req.nextUrl.searchParams.get('season'));
 if(!Number.isSafeInteger(id)||id<1||!Number.isInteger(season)||season<0||season>10000)return NextResponse.json({error:'invalid'},{status:400});
 const data=await tmdb(`tv/${id}/season/${season}`);
 if(!data)return NextResponse.json({error:'Episódios indisponíveis'},{status:503});
 const episodes=(Array.isArray(data.episodes)?data.episodes:[]).filter((e:any)=>Number.isInteger(e?.episode_number)&&e.episode_number>0).map((e:any)=>({
  number:e.episode_number,name:String(e.name||`Episódio ${e.episode_number}`).slice(0,200),overview:typeof e.overview==='string'?e.overview.slice(0,600):'',
  still:typeof e.still_path==='string'&&/^\/[\w.-]+$/.test(e.still_path)?e.still_path:null,runtime:Number.isInteger(e.runtime)&&e.runtime>0?e.runtime:0,airDate:String(e.air_date||'').slice(0,10)}));
 return NextResponse.json({episodes},{headers:{'Cache-Control':'public, max-age=600, s-maxage=3600'}});
}
