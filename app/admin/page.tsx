import AdminPanel,{AdminLogin} from '../../components/AdminPanel';
import {adminReady,storeReady} from '../../lib/ad-store';
import {isAdmin} from '../../lib/admin-auth';
export const dynamic='force-dynamic';
export const metadata={title:'Flix · Anúncios',robots:{index:false,follow:false}};
export default async function Page(){
 if(!adminReady())return <main className="admin-page"><div className="admin-card admin-setup"><span className="eyebrow">PAINEL DE ANÚNCIOS</span><h1>Falta configurar</h1><p>Na Vercel, abra o projeto e conclua os passos abaixo. Depois faça um novo deploy.</p><ol>
  <li className={storeReady()?'done':''}><strong>Banco de dados:</strong> aba <em>Storage</em> → <em>Create Database</em> → <em>Upstash for Redis</em> (plano gratuito) → conecte ao projeto.{storeReady()&&' ✓ Conectado.'}</li>
  <li><strong>Senha do painel:</strong> <em>Settings</em> → <em>Environment Variables</em> → nome <code>ADMIN_PASSWORD</code>, com pelo menos 8 caracteres.</li>
  <li><strong>Novo deploy:</strong> <em>Deployments</em> → ⋯ → <em>Redeploy</em>.</li></ol></div></main>;
 if(!await isAdmin())return <main className="admin-page"><AdminLogin/></main>;
 return <main className="admin-page"><AdminPanel/></main>;
}
