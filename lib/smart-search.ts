// Turns free text like "comedia romantica anos 90" or "vingadorez" into TMDB queries.
export type Intent={genres:{label:string;movie?:number;tv?:number;language?:string}[];type?:'movie'|'tv';year?:number;decade?:number;text:string};
type Genre=Intent['genres'][number]&{words:string[]};
const GENRES:Genre[]=[
 {label:'Ação',movie:28,tv:10759,words:['acao','action','luta','tiroteio']},
 {label:'Aventura',movie:12,tv:10759,words:['aventura','aventuras','adventure']},
 {label:'Animação',movie:16,tv:16,words:['animacao','animado','animados','desenho','desenhos','cartoon']},
 {label:'Anime',movie:16,tv:16,language:'ja',words:['anime','animes']},
 {label:'Comédia',movie:35,tv:35,words:['comedia','comedias','comedy','engracado','engracados','humor','rir']},
 {label:'Crime',movie:80,tv:80,words:['crime','crimes','policial','policiais','mafia','gangster']},
 {label:'Documentário',movie:99,tv:99,words:['documentario','documentarios','documentary','doc']},
 {label:'Drama',movie:18,tv:18,words:['drama','dramas']},
 {label:'Família',movie:10751,tv:10751,words:['familia','infantil','infantis','crianca','criancas','kids']},
 {label:'Fantasia',movie:14,tv:10765,words:['fantasia','fantasy','magia','magico']},
 {label:'História',movie:36,words:['historia','historico','historicos','epico']},
 {label:'Terror',movie:27,words:['terror','horror','medo','assustador','assustadores']},
 {label:'Música',movie:10402,words:['musica','musical','musicais']},
 {label:'Mistério',movie:9648,tv:9648,words:['misterio','misterios','mystery','investigacao']},
 {label:'Romance',movie:10749,words:['romance','romances','romantico','romanticos','romantica','romanticas','amor']},
 {label:'Ficção científica',movie:878,tv:10765,words:['ficcao','scifi','sci-fi','cientifica','espacial','espaco','alienigena','alienigenas']},
 {label:'Suspense',movie:53,words:['suspense','thriller','thrillers']},
 {label:'Guerra',movie:10752,tv:10768,words:['guerra','guerras','war','militar']},
 {label:'Faroeste',movie:37,tv:37,words:['faroeste','western','velho oeste','cowboy']},
 {label:'Reality',tv:10764,words:['reality','realities']},
];
const STOP=new Set(['de','do','da','dos','das','o','a','os','as','um','uma','uns','umas','e','com','para','pra','sobre','no','na','nos','nas','em','que','tipo','genero','bom','bons','boa','boas','melhor','melhores','top','novo','novos','nova','novas','lancamento','lancamentos','assistir','ver','quero','me','mostra','mostre']);
export function normalize(text:string){return text.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();}
// Damerau-Levenshtein (optimal string alignment): counts one swapped pair as a single typo.
export function distance(a:string,b:string){
 const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  const cost=a[i-1]===b[j-1]?0:1;d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
 }
 return d[a.length][b.length];
}
const tolerance=(word:string)=>word.length<4?0:word.length<7?1:2;
export function similar(word:string,target:string){return word===target||(word.length>=4&&Math.abs(word.length-target.length)<=2&&distance(word,target)<=tolerance(target));}
export function parseQuery(raw:string):Intent{
 let words=normalize(raw).split(' ').filter(Boolean);
 const intent:Intent={genres:[],text:''};const used=new Set<number>();
 words.forEach((w,i)=>{
  if(/^(filme|filmes|movie|movies|longa|longas)$/.test(w)){intent.type??='movie';used.add(i);}
  else if(/^(serie|series|seriado|seriados|show|shows|novela|novelas)$/.test(w)){intent.type??='tv';used.add(i);}
  else if(/^(19[2-9]\d|20[0-4]\d)$/.test(w)&&words[i-1]!=='anos'){intent.year=Number(w);used.add(i);}
  else if(w==='anos'&&/^(20|30|40|50|60|70|80|90|2000|2010)$/.test(words[i+1]||'')){const n=Number(words[i+1]);intent.decade=n>=2000?n:1900+n;used.add(i);used.add(i+1);}
 });
 words.forEach((w,i)=>{
  if(used.has(i))return;
  const genre=GENRES.find(g=>g.words.some(t=>!t.includes(' ')&&similar(w,t)));
  if(genre){used.add(i);if(!intent.genres.some(g=>g.label===genre.label)){const {words:_,...clean}=genre;intent.genres.push(clean);}}
 });
 intent.text=words.filter((w,i)=>!used.has(i)&&!STOP.has(w)).join(' ');
 return intent;
}
export function intentLabel(intent:Intent){
 return [intent.genres.map(g=>g.label).join(' + '),intent.type==='movie'?'filmes':intent.type==='tv'?'séries':'',intent.decade?`anos ${String(intent.decade).slice(2)}`:'',intent.year?String(intent.year):''].filter(Boolean).join(' · ');
}
// Trigram overlap of normalized titles, 0..1, used to rank typo-tolerant results.
function grams(text:string){const s=`  ${normalize(text)} `;const out=new Set<string>();for(let i=0;i<s.length-2;i++)out.add(s.slice(i,i+3));return out;}
export function titleScore(query:string,title:string){
 const q=normalize(query),t=normalize(title);if(!q||!t)return 0;if(t===q)return 1;if(t.startsWith(q))return .95;if(t.includes(q))return .85;
 const a=grams(q),b=grams(t);let shared=0;a.forEach(g=>{if(b.has(g))shared++});const dice=2*shared/(a.size+b.size);
 const words=t.split(' '),best=Math.max(0,...q.split(' ').map(w=>Math.max(...words.map(x=>w.length>=4&&similar(w,x)?.8:0))));
 return Math.max(dice,best*.9);
}
// Extra queries for a misspelled title: trimmed word endings and the longest single word.
export function typoVariants(text:string){
 const words=normalize(text).split(' ').filter(w=>w.length>=3);if(!words.length)return [];
 const out=new Set<string>();
 out.add(words.map(w=>w.length>=6?w.slice(0,-2):w.length>=4?w.slice(0,-1):w).join(' '));
 const longest=[...words].sort((a,b)=>b.length-a.length)[0];if(words.length>1)out.add(longest);
 if(longest.length>=5)out.add(longest.slice(0,Math.ceil(longest.length*.6)));
 out.delete(normalize(text));return [...out].slice(0,3);
}
