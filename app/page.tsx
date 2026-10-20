import {cookies,headers} from 'next/headers';
import Home from '../components/HomeExperience';
import Landing from '../components/Landing';
import {isAppAgent,latestRelease} from '../lib/app-release';
import {fillTop,topTitles} from '../lib/top-store';
import {daySeed} from '../lib/top-watch';
import {tmdb} from '../lib/catalog';
import {cleanTitles,discoveryShelves,makeShelves} from '../lib/discovery';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}) {
  const {view}=await searchParams;
  // Browser visitors see the app landing first; the app and "continuar no navegador" open the catalog.
  if(!view&&!isAppAgent((await headers()).get('user-agent'))&&(await cookies()).get('flix-web')?.value!=='1'){
    const [trending,release]=await Promise.all([tmdb('trending/all/week'),latestRelease()]);
    return <Landing posters={cleanTitles(trending).filter(t=>t.poster_path).slice(0,18)} release={release}/>;
  }
  const [trending,films,series,...discovery]=await Promise.all([
    tmdb('trending/all/week'),tmdb('movie/popular'),tmdb('tv/popular'),
    ...discoveryShelves.map(s=>tmdb(`discover/${s.type}?with_genres=${s.genre}&sort_by=popularity.desc&include_adult=false&include_video=false`)),
  ]);
  const movies=cleanTitles(trending),filmTitles=cleanTitles(films,'movie'),seriesTitles=cleanTitles(series,'tv');
  const [watchedMovies,watchedSeries]=await Promise.all([topTitles('movie'),topTitles('tv')]);
  return <Home topMovies={fillTop(watchedMovies,filmTitles)} topSeries={fillTop(watchedSeries,seriesTitles)} seed={daySeed()} movies={movies} films={filmTitles} series={seriesTitles} shelves={makeShelves(discovery,[...movies,...filmTitles,...seriesTitles])} configured={!!process.env.TMDB_TOKEN} initialView={view==='search'?'search':view==='list'?'list':'home'}/>;
}
