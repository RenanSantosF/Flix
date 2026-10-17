package com.renansantos.flix;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Inspects only bytes the decoder already read; never performs another request. */
final class MediaFormatProbe {
    private final byte[] prefix=new byte[1024];
    private int count;
    private String contentType="";
    synchronized void response(String type) {contentType=type==null?"":type.toLowerCase(Locale.ROOT).split(";",2)[0].trim();}
    synchronized void read(byte[] bytes,int offset,int length) {int n=Math.min(length,prefix.length-count);if(n>0){System.arraycopy(bytes,offset,prefix,count,n);count+=n;}}
    synchronized String manifestMime() {
        String text=new String(prefix,0,count,StandardCharsets.UTF_8).replace("\ufeff","").trim();
        if(text.startsWith("#EXTM3U"))return "application/x-mpegURL";
        if(text.startsWith("<MPD")||text.matches("(?s)^<\\?xml[^>]*\\?>\\s*<MPD(?:\\s|>).*"))return "application/dash+xml";
        // A declared MIME alone can be incorrect (including verification/error HTML).
        return "";
    }
    synchronized String description() {
        String mime=manifestMime();
        if(!mime.isEmpty())return mime.contains("dash")?"DASH":"HLS";
        String text=new String(prefix,0,count,StandardCharsets.UTF_8).trim().toLowerCase(Locale.ROOT);
        if(text.startsWith("<!doctype html")||text.startsWith("<html"))return "página HTML";
        if(contentType.matches("[a-z0-9.+-]+/[a-z0-9.+-]+"))return contentType;
        return count>0?"mídia binária":"sem dados de mídia";
    }
}
