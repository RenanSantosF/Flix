export type MediaType = 'movie' | 'tv';
export type Title = {
  id: number; media_type: MediaType; title: string; poster_path?: string | null;
  backdrop_path?: string | null; overview?: string; vote_average?: number;
  release_date?: string; genre_ids?: number[];
};
export function normalizeTitle(value: any, type?: MediaType): Title | null {
  const media_type = type || value?.media_type;
  if (!value || !Number.isSafeInteger(value.id) || value.id < 1 || !['movie', 'tv'].includes(media_type)) return null;
  return {id:value.id, media_type, title:String(value.title || value.name || 'Sem título').slice(0,200),
    poster_path:typeof value.poster_path === 'string' && /^\/[\w.-]+$/.test(value.poster_path) ? value.poster_path : null,
    backdrop_path:typeof value.backdrop_path === 'string' && /^\/[\w.-]+$/.test(value.backdrop_path) ? value.backdrop_path : null,
    overview:typeof value.overview === 'string' ? value.overview.slice(0,3000) : '',
    vote_average:typeof value.vote_average === 'number' ? value.vote_average : 0,
    release_date:String(value.release_date || value.first_air_date || '').slice(0,10),
    genre_ids:Array.isArray(value.genre_ids) ? value.genre_ids.filter(Number.isInteger) : []};
}
export const titleKey = (title: Pick<Title,'id'|'media_type'>) => `${title.media_type}:${title.id}`;
export const titleHref = (title: Pick<Title,'id'|'media_type'>) => `/titulo/${title.media_type}/${title.id}`;
export const imageUrl = (path?: string | null, size='w500') => path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
export async function tmdb(path: string) {
  const token=process.env.TMDB_TOKEN;
  if (!token) return null;
  try {
    const response=await fetch(`https://api.themoviedb.org/3/${path}${path.includes('?')?'&':'?'}language=pt-BR`,
      {headers:{Authorization:`Bearer ${token}`},next:{revalidate:900},signal:AbortSignal.timeout(8000)});
    return response.ok ? await response.json() : null;
  } catch { return null; }
}
// TMDB genre ids (movie and TV) to short Portuguese labels for the featured title.
export const GENRE_NAMES:Record<number,string>={28:'Ação',12:'Aventura',16:'Animação',35:'Comédia',80:'Crime',99:'Documentário',18:'Drama',10751:'Família',14:'Fantasia',36:'História',27:'Terror',10402:'Música',9648:'Mistério',10749:'Romance',878:'Ficção científica',53:'Suspense',10752:'Guerra',37:'Faroeste',10759:'Ação e aventura',10762:'Infantil',10764:'Reality',10765:'Sci-fi e fantasia',10768:'Guerra e política'};
