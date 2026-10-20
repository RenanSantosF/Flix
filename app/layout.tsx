import './style.css';
import UpdatePrompt from '../components/UpdatePrompt';
export const metadata={title:'Flix · Sua próxima história',description:'Filmes e séries no seu ritmo.',applicationName:'Flix',other:{'f18089bc4e70e3054361fe3ce9b1754473f3376c':'f18089bc4e70e3054361fe3ce9b1754473f3376c'}};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#0b0b0f'};
// Opening logo once per app/browser session; the inline script hides it before paint on later pages.
const splashScript="try{if(sessionStorage.getItem('flix-splash'))document.documentElement.classList.add('splash-seen');else sessionStorage.setItem('flix-splash','1')}catch(e){}";
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR" suppressHydrationWarning><body>
 <div id="flix-splash" aria-hidden="true"><div className="splash-logo">{'FLIX'.split('').map((l,i)=><span key={i} style={{animationDelay:`${.08+i*.09}s`}}>{l}</span>)}<i/></div><b className="splash-sweep"/></div>
 <script dangerouslySetInnerHTML={{__html:splashScript}}/>
 {children}<UpdatePrompt/></body></html>;}
