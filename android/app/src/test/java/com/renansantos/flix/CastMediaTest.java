package com.renansantos.flix;
import org.junit.Test;
import static org.junit.Assert.*;
public class CastMediaTest {
 @Test public void mediaPreservesAssignedSourceAndResumeWithoutHeaders(){CastMedia m=new CastMedia("https://cdn.example/play.m3u8?token=private","","Filme",123,3600,false);assertEquals("application/x-mpegURL",m.mime);assertEquals(123000,m.position);assertEquals(3600000,m.duration);assertTrue(m.url.endsWith("token=private"));}
 @Test public void liveAndUnknownDurationsAreSafe(){CastMedia live=new CastMedia("https://cdn.example/channel.mpd","","Ao vivo",99,Double.POSITIVE_INFINITY,true);assertEquals(0,live.position);assertEquals(0,live.duration);assertEquals("application/dash+xml",live.mime);assertEquals("video/mp4",CastMedia.mime("https://cdn.example",""));}
 @Test public void privateAndExecutableSourcesCannotBeSent(){for(String url:new String[]{"file:///secret","blob:https://cdn.example/1","javascript:alert(1)","http://127.0.0.1/a","https://user:secret@cdn.example/a","https://internal.local/a"}){try{new CastMedia(url,"","",0,0,false);fail(url);}catch(IllegalArgumentException expected){}}}
 @Test public void onlyKnownProviderUnsupportedAlertOpensNativeChooser(){assertTrue(CastRequestPolicy.providerUnsupported("https://superflixapi.fun/serie/1396","Transmissão indisponível neste navegador ou dispositivo."));assertFalse(CastRequestPolicy.providerUnsupported("https://ad.example/","Transmissão indisponível neste navegador ou dispositivo."));assertFalse(CastRequestPolicy.providerUnsupported("https://superflixapi.fun/","outro alerta"));}
}
