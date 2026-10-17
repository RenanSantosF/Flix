import Home from '../components/HomeExperience';
import {normalizeTitle,tmdb} from '../lib/catalog';
import type {Title} from '../lib/catalog';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}) {
  const {view}=await searchParams;
  const [trending,films,series]=await Promise.all([tmdb('trending/all/week'),tmdb('movie/popular'),tmdb('tv/popular')]);
  const clean=(data:any,type?:'movie'|'tv')=>(data?.results||[]).map((t:any)=>normalizeTitle(t,type)).filter((t:Title|null):t is Title=>!!t);
  return <Home movies={clean(trending)} films={clean(films,'movie')} series={clean(series,'tv')} configured={!!process.env.TMDB_TOKEN} initialView={view==='search'?'search':view==='list'?'list':'home'}/>;
}
