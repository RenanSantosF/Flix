import './style.css';
export const metadata={title:'Flix · Sua próxima história',description:'Filmes e séries no seu ritmo.',applicationName:'Flix'};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#0b0b0f'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
