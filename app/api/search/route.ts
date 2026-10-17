import {NextRequest,NextResponse} from 'next/server';
import {normalizeTitle,tmdb} from '../../../lib/catalog';
export async function GET(req:NextRequest) {
  const query=(req.nextUrl.searchParams.get('q')||'').trim().slice(0,160);
  const page=Math.max(1,Math.min(500,Number(req.nextUrl.searchParams.get('page'))||1));
  if(!query)return NextResponse.json({results:[],total_pages:0});
  const selected=req.nextUrl.searchParams.get('type');
  const type=selected==='movie'||selected==='tv'?selected:undefined;
  const data=await tmdb(`search/${type||'multi'}?query=${encodeURIComponent(query)}&page=${Math.floor(page)}&include_adult=false`);
  if(!data)return NextResponse.json({error:'Busca indisponível'},{status:503});
  return NextResponse.json({results:(data.results||[]).map((v:any)=>normalizeTitle(v,type)).filter(Boolean),total_pages:Math.min(data.total_pages||1,500)});
}
