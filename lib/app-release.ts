// The Android build is published as the latest GitHub release of this public repository.
export const RELEASE_REPO='RenanSantosF/Flix';
export const APK_URL=`https://github.com/${RELEASE_REPO}/releases/latest/download/Flix.apk`;
export type AppRelease={versionCode:number;versionName:string;notes:string;publishedAt:string;sizeMb:number};
export function isAppAgent(ua:string|null|undefined){return / FlixAndroid\//.test(ua||'');}
// 0 means an app from before builds reported their version.
export function appBuild(ua:string|null|undefined){const m=/ FlixBuild\/(\d{1,6})/.exec(ua||'');return m?Number(m[1]):isAppAgent(ua)?0:null;}
export function parseRelease(data:any):AppRelease|null{
 const code=/^android-v(\d{1,6})$/.exec(String(data?.tag_name||''));if(!code)return null;
 const asset=(Array.isArray(data.assets)?data.assets:[]).find((a:any)=>a?.name==='Flix.apk');if(!asset)return null;
 return {versionCode:Number(code[1]),versionName:String(data.name||'').replace(/^Flix\s+/,'').replace(/-.*$/,'').slice(0,40),notes:String(data.body||'').slice(0,300),publishedAt:String(data.published_at||''),sizeMb:Math.round((Number(asset.size)||0)/1e5)/10};
}
export async function latestRelease():Promise<AppRelease|null>{
 try{
  const response=await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`,{headers:{Accept:'application/vnd.github+json'},next:{revalidate:300},signal:AbortSignal.timeout(6000)});
  return response.ok?parseRelease(await response.json()):null;
 }catch{return null;}
}
