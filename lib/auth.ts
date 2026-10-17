import { SignJWT, jwtVerify } from 'jose';
const secret=()=>new TextEncoder().encode(process.env.SESSION_SECRET||'');
export async function sign(){return new SignJWT({role:'owner'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('7d').sign(secret())}
export async function verify(token?:string){if(!token||!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)return false;try{const r=await jwtVerify(token,secret());return r.payload.role==='owner'}catch{return false}}
