import {NextRequest,NextResponse} from 'next/server';
import {tmdb} from '../../../lib/catalog';
import {cleanTitles,uniqueTitles} from '../../../lib/discovery';
export async function GET(req:NextRequest){
  const value=Number(req.nextUrl.searchParams.get('page')||2);
  if(!Number.isInteger(value)||value<2||value>500)return NextResponse.json({error:'Página inválida'},{status:400});
  const selected=req.nextUrl.searchParams.get('type');
  if(selected!==null&&!['all','movie','tv'].includes(selected))return NextResponse.json({error:'Tipo inválido'},{status:400});
  const types:('movie'|'tv')[]=selected==='movie'||selected==='tv'?[selected]:['movie','tv'];
  const data=await Promise.all(types.map(type=>tmdb(`${type}/popular?page=${value}`)));
  if(data.some(d=>!d))return NextResponse.json({error:'As sugestões não carregaram agora.'},{status:503});
  const pages=Math.min(500,Math.max(...data.map(d=>Number(d.total_pages)||1)));
  const rows=data.map((d,i)=>cleanTitles(d,types[i]));
  const results=[];
  for(let i=0;i<Math.max(...rows.map(r=>r.length));i++)for(const row of rows)if(row[i])results.push(row[i]);
  return NextResponse.json({results:uniqueTitles(results),has_more:value<pages},{headers:{'Cache-Control':'public, s-maxage=900, stale-while-revalidate=3600'}});
}
