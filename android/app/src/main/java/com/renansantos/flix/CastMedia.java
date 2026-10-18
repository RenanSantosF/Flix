package com.renansantos.flix;

/** Immutable snapshot of the user's currently playing media, never cookies or page HTML. */
final class CastMedia {
    final String url,mime,title;final long position,duration;final boolean live;
    CastMedia(String url,String type,String title,double position,double duration,boolean live){
        if(!MediaUrlPolicy.allowedNetwork(url)||NavigationPolicy.isAdUrl(url))throw new IllegalArgumentException("Unsupported cast source");
        this.url=url;this.mime=mime(url,type);this.title=title==null||title.isEmpty()?"Flix":title.substring(0,Math.min(150,title.length()));this.live=live;
        this.position=live?0:(long)(Math.max(0,Double.isFinite(position)?Math.min(position,604800):0)*1000);
        this.duration=live?0:(long)(Math.max(0,Double.isFinite(duration)?Math.min(duration,604800):0)*1000);
    }
    static String mime(String url,String type){
        String path=(java.net.URI.create(url).getPath()==null?"":java.net.URI.create(url).getPath()).toLowerCase(java.util.Locale.ROOT),t=type==null?"":type.toLowerCase(java.util.Locale.ROOT);
        if(path.endsWith(".m3u8")||t.contains("mpegurl"))return "application/x-mpegURL";
        if(path.endsWith(".mpd")||t.contains("dash+xml"))return "application/dash+xml";
        if(t.equals("video/webm")||path.endsWith(".webm"))return "video/webm";
        return "video/mp4";
    }
}
