import './style.css';
export const metadata={title:'Flix · Sua próxima história',description:'Filmes e séries no seu ritmo.',applicationName:'Flix',other:{'f18089bc4e70e3054361fe3ce9b1754473f3376c':'f18089bc4e70e3054361fe3ce9b1754473f3376c'}};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#0b0b0f'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
