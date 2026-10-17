'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main className="error-page"><h1>Vamos tentar mais uma vez?</h1><p>Não conseguimos abrir esta tela agora.</p><button className="button button-light" onClick={reset}>Tentar novamente</button><a href="/">Voltar ao catálogo</a></main>;}
