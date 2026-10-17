import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import TitleDetail from '../../../../components/TitleDetail';
import {tmdb,normalizeTitle} from '../../../../lib/catalog';
type Params={type:string;id:string};
export default async function Detail({params,searchParams}:{params:Promise<Params>;searchParams:Promise<{play?:string}>}){
const {type,id}=await params;
// This is a rendering hint for our WebView, not an authentication mechanism.
const nativeApp=((await headers()).get('user-agent')||'').includes(' FlixAndroid/1.0');
if(!['tv','movie'].includes(type)||!/^[0-9]+$/.test(id))notFound();
const [data,recommendations,query]=await Promise.all([tmdb(`${type}/${id}`),tmdb(`${type}/${id}/recommendations`),searchParams]);
const mediaType=type as 'movie'|'tv';
const title=normalizeTitle(data||{id:Number(id),title:'Detalhes'},mediaType)!;
return <TitleDetail title={title} seasons={Array.isArray(data?.seasons)?data.seasons:[]} genres={(data?.genres||[]).map((g:any)=>String(g.name))} runtime={data?.runtime||0} similar={(recommendations?.results||[]).slice(0,12).map((t:any)=>normalizeTitle(t,mediaType)).filter(Boolean)} nativeApp={nativeApp} autoPlay={query.play==='1'}/>;
}
