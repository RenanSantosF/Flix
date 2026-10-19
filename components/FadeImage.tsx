'use client';
import {useEffect,useRef,useState} from 'react';
// Hidden until fully decoded, so slow connections show a shimmer instead of a half-drawn image.
export default function FadeImage({src,className='',...rest}:React.ImgHTMLAttributes<HTMLImageElement>&{src:string}){
 const img=useRef<HTMLImageElement>(null),[shown,setShown]=useState(false);
 const reveal=(el:HTMLImageElement)=>{(el.decode?el.decode().catch(()=>{}):Promise.resolve()).then(()=>setShown(true));};
 // Cached images can finish before hydration, when onLoad has already fired.
 useEffect(()=>{setShown(false);const el=img.current;if(el?.complete&&el.naturalWidth)reveal(el);},[src]);
 return <img ref={img} src={src} className={'fade-img'+(shown?' is-shown':'')+(className?' '+className:'')} onLoad={e=>reveal(e.currentTarget)} onError={()=>setShown(true)} {...rest}/>;
}
