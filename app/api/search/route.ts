import {NextRequest,NextResponse} from 'next/server';
import {normalizeTitle,titleKey,tmdb} from '../../../lib/catalog';
import type {MediaType,Title} from '../../../lib/catalog';
import {intentLabel,parseQuery,titleScore,typoVariants} from '../../../lib/smart-search';
import type {Intent} from '../../../lib/smart-search';
type Scored=Title&{score:number};
async function discover(intent:Intent,type:MediaType,page:number){
 const ids=intent.genres.map(g=>g[type]).filter(Boolean);
 if(intent.genres.length&&!ids.length)return null;
 const params=new URLSearchParams({sort_by:'popularity.desc',page:String(page),include_adult:'false','vote_count.gte':'40'});
 if(ids.length)params.set('with_genres',ids.join(','));
 const language=intent.genres.find(g=>g.language)?.language;if(language)params.set('with_original_language',language);
 const field=type==='movie'?'primary_release_date':'first_air_date';
 if(intent.year){params.set(field+'.gte',`${intent.year}-01-01`);params.set(field+'.lte',`${intent.year}-12-31`);}
 else if(intent.decade){params.set(field+'.gte',`${intent.decade}-01-01`);params.set(field+'.lte',`${intent.decade+9}-12-31`);}
 return tmdb(`discover/${type}?${params}`);
}
// Title matches, plus the best-known work of matching people (search "tom hanks" → his films).
function fromSearch(data:any,query:string,type?:MediaType):Scored[]{
 const out:Scored[]=[];
 for(const v of data?.results||[]){
  if(v.media_type==='person'){if((v.popularity||0)>=3)for(const k of v.known_for||[]){const t=normalizeTitle(k,type);if(t&&(!type||t.media_type===type))out.push({...t,score:.7*Math.max(titleScore(query,v.name||''),.5)});}continue;}
  const t=normalizeTitle(v,type);if(t)out.push({...t,score:titleScore(query,t.title)+Math.min(.15,(v.popularity||0)/2000)});
 }
 return out;
}
export async function GET(req:NextRequest) {
 const query=(req.nextUrl.searchParams.get('q')||'').trim().slice(0,160);
 const page=Math.max(1,Math.min(500,Math.floor(Number(req.nextUrl.searchParams.get('page'))||1)));
 if(!query)return NextResponse.json({results:[],total_pages:0});
 const selected=req.nextUrl.searchParams.get('type');
 const intent=parseQuery(query);
 const type:MediaType|undefined=selected==='movie'||selected==='tv'?selected:intent.type;
 const types:MediaType[]=type?[type]:['movie','tv'];
 const filtered=intent.genres.length>0||!!intent.year||!!intent.decade;
 // "comedia anos 90", "terror", "series de anime": browse by genre/period instead of matching names.
 if(filtered&&!intent.text){
  const pages=await Promise.all(types.map(t=>discover(intent,t,page)));
  if(pages.every(p=>!p))return NextResponse.json({error:'Busca indisponível'},{status:503});
  const lists=pages.map((p,i)=>(p?.results||[]).map((v:any)=>normalizeTitle(v,types[i])).filter(Boolean) as Title[]);
  const results:Title[]=[];for(let i=0;i<Math.max(...lists.map(l=>l.length));i++)for(const l of lists)if(l[i])results.push(l[i]);
  return NextResponse.json({results,total_pages:Math.min(500,Math.max(...pages.map(p=>p?.total_pages||0))),understood:intentLabel(intent)});
 }
 const text=intent.text||query;
 const path=(q:string,p:number)=>`search/${type||'multi'}?query=${encodeURIComponent(q)}&page=${p}&include_adult=false`;
 const data=await tmdb(path(text,page));
 if(!data)return NextResponse.json({error:'Busca indisponível'},{status:503});
 let scored=fromSearch(data,text,type);
 // Misspelled titles ("vingadorez", "homem aranah"): try looser queries and keep the closest names.
 if(page===1&&scored.filter(t=>t.score>=.6).length<5){
  const extra=await Promise.all(typoVariants(text).map(q=>tmdb(path(q,1))));
  for(const d of extra)scored.push(...fromSearch(d,text,type).filter(t=>t.score>=.45));
 }
 if(filtered&&page===1){
  const genreIds=new Set(intent.genres.flatMap(g=>[g.movie,g.tv]).filter(Boolean));
  if(genreIds.size)scored=scored.map(t=>t.genre_ids?.some(id=>genreIds.has(id))?{...t,score:t.score+.3}:t);
 }
 const seen=new Set<string>(),results:Title[]=[];
 for(const t of scored.sort((a,b)=>b.score-a.score)){const key=titleKey(t);if(seen.has(key))continue;seen.add(key);const {score:_,...clean}=t;results.push(clean);}
 return NextResponse.json({results,total_pages:Math.min(data.total_pages||1,500),understood:filtered?intentLabel(intent):''});
}
