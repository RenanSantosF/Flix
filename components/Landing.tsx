import Icon from './Icons';
import {imageUrl} from '../lib/catalog';
import type {Title} from '../lib/catalog';
import type {AppRelease} from '../lib/app-release';
import type {IconName} from './Icons';
const FEATURES:{icon:IconName;title:string;text:string}[]=[
 {icon:'play',title:'Filmes e séries',text:'Um catálogo que cresce todo dia, com busca que entende gênero, ator e até erro de digitação.'},
 {icon:'live',title:'Ao vivo',text:'Canais e a agenda de jogos em um só lugar.'},
 {icon:'clock',title:'De onde parou',text:'Cada episódio guarda o seu progresso. É só tocar e continuar.'},
 {icon:'cast',title:'Na sua TV',text:'Transmita para a TV ou use a janela flutuante enquanto faz outra coisa.'},
];
// Browser visitors land here; the Android app (and "continuar no navegador") goes straight to the catalog.
export default function Landing({posters,release}:{posters:Title[];release:AppRelease|null}){
 const rows=[0,1,2].map(r=>posters.filter((_,i)=>i%3===r));
 return <main className="landing">
  <section className="landing-hero">
   <div className="landing-wall" aria-hidden="true">{rows.map((row,r)=><div key={r} className={'landing-row r'+r}>{[...row,...row].map((t,i)=>t.poster_path&&<img key={i} src={imageUrl(t.poster_path,'w185')} alt="" loading={r===0&&i<6?'eager':'lazy'}/>)}</div>)}</div>
   <div className="landing-shade"/>
   <div className="landing-copy">
    <span className="landing-logo">FLIX<span>·</span></span>
    <h1>Sua próxima história, <em>no bolso.</em></h1>
    <p>Filmes, séries e jogos ao vivo no app do Flix para Android. Grátis, leve e sempre atualizado.</p>
    <a className="landing-cta" href="/baixar"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22a11.4 11.4 0 0 0-9.84 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"/></svg><span>Baixar o app<small>{release?`Android · versão ${release.versionName}${release.sizeMb?` · ${release.sizeMb.toLocaleString('pt-BR')} MB`:''}`:'Android'}</small></span></a>
    <a className="landing-web" href="/continuar">Continuar no navegador <Icon name="chevron" size={14}/></a>
   </div>
  </section>
  <section className="landing-section">
   <h2>Instale em 3 passos</h2>
   <ol className="landing-steps">
    <li><b>1</b><div><strong>Toque em “Baixar o app”</strong><span>O arquivo Flix.apk baixa direto no celular.</span></div></li>
    <li><b>2</b><div><strong>Abra o arquivo e permita a instalação</strong><span>Na primeira vez o Android pede para liberar “instalar apps desta fonte”. É só ativar e voltar.</span></div></li>
    <li><b>3</b><div><strong>Pronto, é só assistir</strong><span>Quando sair versão nova, o próprio app avisa e atualiza em um toque.</span></div></li>
   </ol>
  </section>
  <section className="landing-section">
   <h2>Tudo que você precisa</h2>
   <div className="landing-features">{FEATURES.map(f=><article key={f.title}><span><Icon name={f.icon} size={22}/></span><h3>{f.title}</h3><p>{f.text}</p></article>)}</div>
  </section>
  <section className="landing-section landing-final">
   <h2>Usa iPhone ou computador?</h2>
   <p>O app é para Android, mas o Flix também funciona no navegador.</p>
   <div><a className="landing-cta small" href="/baixar">Baixar para Android</a><a className="landing-web" href="/continuar">Abrir no navegador <Icon name="chevron" size={14}/></a></div>
  </section>
  <footer className="app-footer"><span className="wordmark">FLIX<span>·</span></span><p>Sua próxima história está aqui.</p></footer>
 </main>;
}
