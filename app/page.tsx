import Home from '../components/HomeExperience';
import {tmdb} from '../lib/catalog';
import {cleanTitles,discoveryShelves,makeShelves} from '../lib/discovery';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}) {
  const {view}=await searchParams;
  const [trending,films,series,...discovery]=await Promise.all([
    tmdb('trending/all/week'),tmdb('movie/popular'),tmdb('tv/popular'),
    ...discoveryShelves.map(s=>tmdb(`discover/${s.type}?with_genres=${s.genre}&sort_by=popularity.desc&include_adult=false&include_video=false`)),
  ]);
  const movies=cleanTitles(trending),filmTitles=cleanTitles(films,'movie'),seriesTitles=cleanTitles(series,'tv');
  return <Home movies={movies} films={filmTitles} series={seriesTitles} shelves={makeShelves(discovery,[...movies,...filmTitles,...seriesTitles])} configured={!!process.env.TMDB_TOKEN} initialView={view==='search'?'search':view==='list'?'list':'home'}/>;
}
