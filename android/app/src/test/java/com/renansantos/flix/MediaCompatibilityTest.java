package com.renansantos.flix;
import java.nio.charset.StandardCharsets;
import org.junit.Test;
import static org.junit.Assert.*;
public class MediaCompatibilityTest {
    @Test public void sameOriginReferrerKeepsPageButNeverFragment() {
        MediaRequestContext c=new MediaRequestContext("https://player.example/embed/123?token=secret#play","https://player.example","","none");
        assertEquals("https://player.example/embed/123?token=secret",c.headers("https://player.example/stream").get("Referer"));
        assertEquals("https://player.example/",c.headers("https://cdn.example/stream").get("Referer"));
        assertFalse(c.headers("https://cdn.example/stream").containsKey("Origin"));
    }
    @Test public void respectsExplicitPolicyAndDeclaredCorsAcrossRedirects() {
        MediaRequestContext c=new MediaRequestContext("https://player.example/embed/123","https://player.example","no-referrer","anonymous");
        assertFalse(c.headers("https://cdn.example/stream").containsKey("Referer"));
        assertEquals("https://player.example",c.headers("https://cdn.example/stream").get("Origin"));
        assertFalse(c.cookiesAllowed("https://cdn.example/stream"));assertTrue(c.cookiesAllowed("https://player.example/stream"));
        assertTrue(new MediaRequestContext("https://player.example/p","https://player.example","origin","use-credentials").cookiesAllowed("https://cdn.example/s"));
    }
    @Test public void cannotSubstituteAnotherFrameOrLeakPageToOtherOriginsByDefault() {
        MediaRequestContext c=new MediaRequestContext("https://attacker.example/path?secret=x","https://player.example","","none");
        assertEquals("https://player.example/",c.headers("https://player.example/stream").get("Referer"));
        assertEquals("https://player.example/",c.headers("https://cdn.example/stream").get("Referer"));
    }
    @Test public void detectsExtensionlessManifestFromActualBytesAcrossReads() {
        MediaFormatProbe p=new MediaFormatProbe();p.response("video/mp4");
        byte[] b="\ufeff #EXTM3U\n#EXT-X-ENDLIST\n".getBytes(StandardCharsets.UTF_8);p.read(b,0,5);p.read(b,5,b.length-5);
        assertEquals("application/x-mpegURL",p.manifestMime());assertEquals("HLS",p.description());
        p=new MediaFormatProbe();b="<?xml version=\"1.0\"?>\n<MPD xmlns=\"urn:mpeg:dash:schema:mpd:2011\">".getBytes(StandardCharsets.UTF_8);p.read(b,0,b.length);assertEquals("application/dash+xml",p.manifestMime());
    }
    @Test public void htmlOrWrongMimeCannotBecomeAManifest() {
        MediaFormatProbe p=new MediaFormatProbe();p.response("application/vnd.apple.mpegurl");byte[] b="<!doctype html><html>Verification required</html>".getBytes(StandardCharsets.UTF_8);p.read(b,0,b.length);
        assertEquals("",p.manifestMime());assertEquals("página HTML",p.description());
    }
}
