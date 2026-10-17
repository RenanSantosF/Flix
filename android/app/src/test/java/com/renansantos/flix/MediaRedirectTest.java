package com.renansantos.flix;

import java.io.IOException;
import java.net.InetAddress;
import java.util.Collections;
import java.util.concurrent.TimeUnit;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import okhttp3.tls.HandshakeCertificates;
import okhttp3.tls.HeldCertificate;
import org.junit.Test;
import static org.junit.Assert.*;

public class MediaRedirectTest {
    private OkHttpClient.Builder client() {
        // Only these tests map synthetic public names to their local test servers.
        // Production still rejects private DNS results before opening a socket.
        return new OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
            .dns(host->Collections.singletonList(InetAddress.getLoopbackAddress()))
            .connectTimeout(3,TimeUnit.SECONDS).readTimeout(3,TimeUnit.SECONDS)
            .addInterceptor(new MediaRedirectInterceptor());
    }
    private HttpUrl url(MockWebServer server,String host,String path) {return server.url(path).newBuilder().host(host).build();}
    @Test public void realHttps302CanReachHttpVideoPreservingRangeWithoutCopyingCredentials() throws Exception {
        HeldCertificate certificate=new HeldCertificate.Builder().commonName("origin.example").addSubjectAlternativeName("origin.example").build();
        HandshakeCertificates serverTls=new HandshakeCertificates.Builder().heldCertificate(certificate).build();
        HandshakeCertificates clientTls=new HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate()).build();
        try(MockWebServer https=new MockWebServer();MockWebServer http=new MockWebServer()) {
            https.useHttps(serverTls.sslSocketFactory(),false);https.start();http.start();
            HttpUrl destination=url(http,"cdn.example","/video.mp4?token=signed");
            https.enqueue(new MockResponse().setResponseCode(302).setHeader("Location",destination.toString()));
            http.enqueue(new MockResponse().setBody("video-bytes").setHeader("Content-Type","video/mp4"));
            OkHttpClient client=client().sslSocketFactory(clientTls.sslSocketFactory(),clientTls.trustManager()).build();
            Request request=new Request.Builder().url(url(https,"origin.example","/start")).header("Range","bytes=0-").header("Authorization","private").header("Cookie","session=private").build();
            try(Response response=client.newCall(request).execute()) {
                assertEquals(200,response.code());assertEquals("video-bytes",response.body().string());assertEquals(destination,response.request().url());
            }
            RecordedRequest first=https.takeRequest(3,TimeUnit.SECONDS),last=http.takeRequest(3,TimeUnit.SECONDS);
            assertNotNull(first);assertNotNull(last);assertEquals("private",first.getHeader("Authorization"));
            assertEquals("/video.mp4?token=signed",last.getPath());assertEquals("bytes=0-",last.getHeader("Range"));
            assertNull(last.getHeader("Authorization"));assertNull(last.getHeader("Cookie"));
        }
    }
    @Test public void relativeLocationUsesTheRespondingUrlAndKeepsSignedQuery() throws Exception {
        try(MockWebServer server=new MockWebServer()) {
            server.start();server.enqueue(new MockResponse().setResponseCode(302).setHeader("Location","../video?token=a%2Bb"));server.enqueue(new MockResponse().setBody("video"));
            try(Response response=client().build().newCall(new Request.Builder().url(url(server,"cdn.example","/embed/start")).build()).execute()) {
                assertEquals("video",response.body().string());assertEquals("/video?token=a%2Bb",response.request().url().encodedPath()+"?"+response.request().url().encodedQuery());
            }
            assertEquals(2,server.getRequestCount());
        }
    }
    @Test public void missingUnsafeOrPrivateDestinationsStopBeforeASecondRequest() throws Exception {
        for(String location:new String[]{"", "http://127.0.0.1/private", "http://host.local/video", "file:///sdcard/video", "https://user:password@cdn.example/video"}) {
            try(MockWebServer server=new MockWebServer()) {
                server.start();MockResponse reply=new MockResponse().setResponseCode(302);if(!location.isEmpty())reply.setHeader("Location",location);server.enqueue(reply);
                try(Response ignored=client().build().newCall(new Request.Builder().url(url(server,"cdn.example","/start")).build()).execute()) {fail("Must reject redirect");}
                catch(MediaRedirectInterceptor.Failure expected){assertFalse(expected.getMessage().contains("password"));assertFalse(expected.getMessage().contains("127.0.0.1"));}
                assertEquals(1,server.getRequestCount());
            }
        }
    }
    @Test public void loopsAreBoundedAndAuthorizationFailuresAreNeverRetried() throws Exception {
        try(MockWebServer server=new MockWebServer()) {
            server.start();server.enqueue(new MockResponse().setResponseCode(302).setHeader("Location","/b"));server.enqueue(new MockResponse().setResponseCode(302).setHeader("Location","/a"));
            try(Response ignored=client().build().newCall(new Request.Builder().url(url(server,"cdn.example","/a")).build()).execute()){fail("Loop must fail");}
            catch(MediaRedirectInterceptor.Failure expected){assertTrue(expected.getMessage().contains("ciclo"));}
            assertEquals(2,server.getRequestCount());
        }
        try(MockWebServer server=new MockWebServer()) {
            server.start();server.enqueue(new MockResponse().setResponseCode(403).setHeader("Location","/other"));
            try(Response response=client().build().newCall(new Request.Builder().url(url(server,"cdn.example","/denied")).build()).execute()){assertEquals(403,response.code());}
            assertEquals(1,server.getRequestCount());
        }
    }
    @Test public void longRedirectChainsStopAtTheConfiguredLimit() throws Exception {
        try(MockWebServer server=new MockWebServer()) {
            server.start();for(int i=0;i<15;i++)server.enqueue(new MockResponse().setResponseCode(302).setHeader("Location","/video?hop="+(i+1)));
            try(Response ignored=client().build().newCall(new Request.Builder().url(url(server,"cdn.example","/video?hop=0")).build()).execute()){fail("Must stop chain");}
            catch(MediaRedirectInterceptor.Failure expected){assertTrue(expected.getMessage().contains("limite"));}
            assertEquals(MediaRedirectInterceptor.MAX_REDIRECTS+1,server.getRequestCount());
        }
    }
    @Test public void downgradeOmitsStrictReferrerAndStillHonorsDeclaredCors() {
        MediaRequestContext context=new MediaRequestContext("https://origin.example/embed?token=secret","https://origin.example","","anonymous");
        assertFalse(context.headers("http://cdn.example/video").containsKey("Referer"));assertEquals("https://origin.example",context.headers("http://cdn.example/video").get("Origin"));assertFalse(context.cookiesAllowed("http://cdn.example/video"));
    }
}
