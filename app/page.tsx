import {cookies,headers} from 'next/headers';
import Home from '../components/HomeExperience';
import Landing from '../components/Landing';
import {isAppAgent,latestRelease} from '../lib/app-release';
import {fillTop,topTitles} from '../lib/top-store';
import {daySeed} from '../lib/top-watch';
import {tmdb} from '../lib/catalog';
import {animeShelves,cleanTitles,discoveryShelves,makeShelves} from '../lib/discovery';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}) {
  const {view}=await searchParams;
  // Browser visitors see the app landing first; the app and "continuar no navegador" open the catalog.
  if(!view&&!isAppAgent((await headers()).get('user-agent'))&&(await cookies()).get('flix-web')?.value!=='1'){
    const [trending,release]=await Promise.all([tmdb('trending/all/week'),latestRelease()]);
    return <Landing posters={cleanTitles(trending).filter(t=>t.poster_path).slice(0,18)} release={release}/>;
  }
  const [trending,films,series,animeData,...discovery]=await Promise.all([
    tmdb('trending/all/week'),tmdb('movie/popular'),tmdb('tv/popular'),Promise.all(animeShelves.map(s=>tmdb(s.query))),
    ...discoveryShelves.map(s=>tmdb(`discover/${s.type}?with_genres=${s.genre}&sort_by=popularity.desc&include_adult=false&include_video=false`)),
  ]);
  const movies=cleanTitles(trending),filmTitles=cleanTitles(films,'movie'),seriesTitles=cleanTitles(series,'tv');
  const [watchedMovies,watchedSeries]=await Promise.all([topTitles('movie'),topTitles('tv')]);
  const animes=animeShelves.map((s,i)=>({id:s.id,label:s.label,type:s.type,titles:cleanTitles(animeData[i],s.type)})).filter(s=>s.titles.length>0);
  // Séries and Filmes rank without animes; animes get their own ten.
  const notAnime=(t:{anime?:boolean})=>!t.anime;
  return <Home topMovies={fillTop(watchedMovies.filter(notAnime),filmTitles.filter(notAnime))} topSeries={fillTop(watchedSeries.filter(notAnime),seriesTitles.filter(notAnime))} topAnimes={fillTop([...watchedSeries,...watchedMovies].filter(t=>t.anime),animes[0]?.titles||[])} animes={animes} seed={daySeed()} movies={movies} films={filmTitles} series={seriesTitles} shelves={makeShelves(discovery,[...movies,...filmTitles,...seriesTitles])} configured={!!process.env.TMDB_TOKEN} initialView={view==='search'?'search':view==='list'?'list':'home'}/>;
}
