import {SUPERFLIX_ORIGIN,normalizeLiveList,liveRows} from './live-catalog';
import type {LiveCatalog} from './live-catalog';
async function load(kind:'channel'|'event') {
 const category=kind==='channel'?'canais':'eventos';
 const response=await fetch(`${SUPERFLIX_ORIGIN}/lista?category=${category}&format=json`,{signal:AbortSignal.timeout(10000),redirect:'error',next:{revalidate:60},headers:{Accept:'application/json'}});
 if(!response.ok){await response.body?.cancel();throw Error(response.status===403?'provider_denied':'provider_unavailable')}
 if(!response.headers.get('content-type')?.includes('json')){await response.body?.cancel();throw Error('invalid_response')}
 const reader=response.body?.getReader();if(!reader)throw Error('empty_response');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>3*1024*1024)throw Error('response_too_large');chunks.push(value)}}catch(e){await reader.cancel();throw e}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 const data=JSON.parse(new TextDecoder().decode(bytes));
 const items=normalizeLiveList(data,kind);
 if(liveRows(data,kind).length&&!items.length)throw Error('invalid_response');
 // Nonempty rows in an unrecognized schema must never masquerade as an empty schedule.
 if(!Array.isArray(data)&&(!data||typeof data!=='object'||Object.keys(data).every(k=>!['channels','canais','events','eventos','results','items','data'].includes(k))))throw Error('invalid_response');
 return items;
}
export async function getLiveCatalog():Promise<LiveCatalog>{
 const [channels,events]=await Promise.allSettled([load('channel'),load('event')]);
 return {channels:channels.status==='fulfilled'?channels.value:[],events:events.status==='fulfilled'?events.value:[],errors:{...(channels.status==='rejected'?{channels:channels.reason?.message==='provider_denied'?'O provedor recusou a consulta de canais.':'Os canais não carregaram agora.'}:{}),...(events.status==='rejected'?{events:events.reason?.message==='provider_denied'?'O provedor recusou a consulta da agenda.':'A agenda não carregou agora.'}:{})},updatedAt:new Date().toISOString()};
}
