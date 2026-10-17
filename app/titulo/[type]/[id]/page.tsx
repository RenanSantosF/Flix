import Link from 'next/link';
import Player from '../../../../components/Player';
type Params={type:string;id:string};
export default async function Detail({params}:{params:Promise<Params>}){
const {type,id}=await params;
if(!['tv','movie'].includes(type)||!/^[0-9]+$/.test(id))return <main>Identificador inválido.</main>;
let data:any=null;
const token=process.env.TMDB_TOKEN;
if(token){try{const r=await fetch('https://api.themoviedb.org/3/'+type+'/'+id+'?language=pt-BR',{headers:{Authorization:'Bearer '+token},next:{revalidate:900}});if(r.ok)data=await r.json()}catch{}}
return <main><header><Link className="logo" href="/">FLIX<span>.</span></Link></header><section className="detail"><Link href="/">← Voltar</Link><div className="movieInfo">{data?.poster_path&&<img className="detailPoster" src={'https://image.tmdb.org/t/p/w500'+data.poster_path} alt={data?.title||data?.name||'Capa'}/>}<div><h1>{data?.title||data?.name||'Detalhes'}</h1><p className="metadata">{data?.release_date||data?.first_air_date||''} {typeof data?.vote_average==='number'?' • ★ '+data.vote_average.toFixed(1):''}</p><p>{data?.overview||'Sem sinopse disponível.'}</p></div></div><Player type={type as 'tv'|'movie'} id={id} seasons={Array.isArray(data?.seasons)?data.seasons:[]}/></section></main>
}