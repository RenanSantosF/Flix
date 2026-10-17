import type {CSSProperties} from 'react';
export type IconName='home'|'search'|'list'|'play'|'plus'|'check'|'back'|'close'|'next'|'pip'|'refresh'|'star'|'chevron'|'clock'|'live';
const paths:Record<IconName,React.ReactNode>={
 live:<><rect x="2" y="7" width="20" height="14" rx="3"/><path d="m8 2 4 5 4-5"/><path d="m10 11 5 3-5 3Z"/></>,
 home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></>,
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 list:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
 play:<path d="m9 5 11 7-11 7Z"/>,plus:<path d="M12 5v14M5 12h14"/>,check:<path d="m5 12 4 4L19 6"/>,
 back:<path d="m14 5-7 7 7 7"/>,close:<path d="m6 6 12 12M18 6 6 18"/>,next:<><path d="m5 5 10 7-10 7Z"/><path d="M19 5v14"/></>,
 pip:<><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="11" width="7" height="6" rx="1"/></>,
 refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,
 star:<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.5l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z"/>,
 chevron:<path d="m9 5 7 7-7 7"/>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>};
export default function Icon({name,size=22,style}:{name:IconName;size?:number;style?:CSSProperties}) {return <svg width={size} height={size} viewBox="0 0 24 24" fill={name==='play'?'currentColor':'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>;}
