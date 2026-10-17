package com.renansantos.flix;
import java.net.InetAddress;
import org.junit.Test;
import static org.junit.Assert.*;
public class MediaUrlPolicyTest {
    @Test public void acceptsPublicHttpsMediaWithSignedQueries() {
        assertTrue(MediaUrlPolicy.allowed("https://cdn.provider.example/video.m3u8?token=signed"));
        assertTrue(MediaUrlPolicy.allowed("https://superflixapi.fun/stream/clip"));
        assertEquals("https://player.provider.example/",MediaUrlPolicy.origin("https://player.provider.example/embed/secret?token=private"));
    }
    @Test public void rejectsLocalSchemesCredentialsAndAdHosts() {
        for(String url:new String[]{"http://cdn.example/a.mp4","file:///sdcard/a.mp4","data:video/mp4;abc","blob:https://example.org/abc","https://127.0.0.1/a","https://2130706433/a","https://[::1]/a","https://host.local/a","https://localhost/a","https://user:password@cdn.example/a","https://asiafilm.org/ad","https://cdn.example:444/a"})assertFalse(url,MediaUrlPolicy.allowed(url));
    }
    @Test public void dnsCannotRedirectMediaToPrivateNetworks() throws Exception {
        for(byte[] ip:new byte[][]{{127,0,0,1},{10,0,0,1},{(byte)192,(byte)168,1,1},{(byte)169,(byte)254,1,1},{(byte)172,16,0,1}})assertFalse(MediaUrlPolicy.publicAddress(InetAddress.getByAddress(ip)));
        assertTrue(MediaUrlPolicy.publicAddress(InetAddress.getByAddress(new byte[]{8,8,8,8})));
        byte[] v6=new byte[16];v6[0]=(byte)0xfd;assertFalse(MediaUrlPolicy.publicAddress(InetAddress.getByAddress(v6)));
    }
}
