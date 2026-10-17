import {headers} from 'next/headers';
import LiveExperience from '../../components/LiveExperience';
export default async function Page({searchParams}:{searchParams:Promise<{id?:string;tipo?:string}>}){const query=await searchParams;const nativeApp=(await headers()).get('user-agent')?.includes(' FlixAndroid/1.0')||false;return <LiveExperience nativeApp={nativeApp} initialId={query.id?.slice(0,100)} initialKind={query.tipo}/>;}
