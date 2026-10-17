package com.renansantos.flix;
import java.net.InetAddress;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicLong;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.Test;
import static org.junit.Assert.*;
public class MediaRateLimitTest {
    @Test public void parsesDelaySecondsDatesClockSkewAndLegacyHttpDates() {
        assertEquals(125000,MediaRateLimit.parse("120",null,5000).until);
        MediaRateLimit.Deadline date=MediaRateLimit.parse("Sun, 06 Nov 1994 08:51:37 GMT","Sun, 06 Nov 1994 08:49:37 GMT",5000);
        assertEquals(125000,date.until);assertTrue(date.supplied);
        assertEquals(125000,MediaRateLimit.parse("Sunday, 06-Nov-94 08:51:37 GMT","Sun, 06 Nov 1994 08:49:37 GMT",5000).until);
        assertEquals(125000,MediaRateLimit.parse("Sun Nov 6 08:51:37 1994","Sun, 06 Nov 1994 08:49:37 GMT",5000).until);
    }
    @Test public void missingOrInvalidHeaderUsesAnExplicitConservativeDefaultWithoutGuaranteeingRelease() {
        for(String value:new String[]{null,"invalid","-20"}){MediaRateLimit.Deadline d=MediaRateLimit.parse(value,null,5000);assertEquals(65000,d.until);assertFalse(d.supplied);}
        assertEquals(Long.MAX_VALUE,MediaRateLimit.parse("999999999999999999999999999999",null,5000).until);
    }
    @Test public void cooldownIsSharedAcrossClientsAndOnlyExpiresAfterTheAdvertisedDeadline() throws Exception {
        AtomicLong clock=new AtomicLong(5000);MediaRateLimit.Store store=new MediaRateLimit.MemoryStore();
        try(MockWebServer server=new MockWebServer()) {
            server.start();server.enqueue(new MockResponse().setResponseCode(429).setHeader("Retry-After","120"));server.enqueue(new MockResponse().setBody("video"));
            String url=server.url("/video?token=private").newBuilder().host("cdn.example").build().toString();
            OkHttpClient first=client(new MediaRateLimit(store,clock::get));
            try(Response ignored=first.newCall(new Request.Builder().url(url).build()).execute()){fail("Expected 429");}
            catch(MediaRateLimit.Limited expected){assertEquals("cdn.example",expected.host);assertEquals(125000,expected.deadline.until);assertFalse(expected.getMessage().contains("token"));}
            OkHttpClient reopened=client(new MediaRateLimit(store,clock::get));
            try(Response ignored=reopened.newCall(new Request.Builder().url(url).build()).execute()){fail("Cooldown must prevent a request");}catch(MediaRateLimit.Limited expected){}
            assertEquals(1,server.getRequestCount());clock.set(125000);
            try(Response response=reopened.newCall(new Request.Builder().url(url).build()).execute()){assertEquals("video",response.body().string());}
            assertEquals(2,server.getRequestCount());
        }
    }
    @Test public void tracksTheHostThatActuallyReturned429AfterARedirect() throws Exception {
        AtomicLong clock=new AtomicLong(5000);MediaRateLimit.Store store=new MediaRateLimit.MemoryStore();
        try(MockWebServer origin=new MockWebServer();MockWebServer cdn=new MockWebServer()) {
            origin.start();cdn.start();String destination=cdn.url("/stream").newBuilder().host("cdn.example").build().toString();
            origin.enqueue(new MockResponse().setResponseCode(302).setHeader("Location",destination));cdn.enqueue(new MockResponse().setResponseCode(429).setHeader("Retry-After","10"));
            OkHttpClient client=new OkHttpClient.Builder().followRedirects(false).dns(h->Collections.singletonList(InetAddress.getLoopbackAddress()))
                .addInterceptor(new MediaRedirectInterceptor()).addInterceptor(new MediaRateLimit(store,clock::get)).build();
            try(Response ignored=client.newCall(new Request.Builder().url(origin.url("/start").newBuilder().host("origin.example").build()).build()).execute()){fail("Expected cooldown");}
            catch(MediaRateLimit.Limited expected){assertEquals("cdn.example",expected.host);}
            assertNull(store.get("origin.example"));assertEquals(15000,store.get("cdn.example").until);
        }
    }
    @Test public void browserDeadlineBlocksNativeTransportAndCannotBeShortened() throws Exception {
        AtomicLong clock=new AtomicLong(5000);MediaRateLimit.MemoryStore store=new MediaRateLimit.MemoryStore();
        MediaRateLimit limiter=new MediaRateLimit(store,clock::get);
        limiter.observe("cdn.example","20",null);clock.set(6000);limiter.observe("cdn.example","2",null);
        assertEquals(25000,store.get("cdn.example").until);
        java.util.concurrent.atomic.AtomicInteger calls=new java.util.concurrent.atomic.AtomicInteger();
        OkHttpClient client=new OkHttpClient.Builder().addInterceptor(limiter).addInterceptor(chain->{calls.incrementAndGet();return new Response.Builder().request(chain.request()).protocol(okhttp3.Protocol.HTTP_1_1).code(200).message("OK").body(okhttp3.ResponseBody.create(null,"video")).build();}).build();
        Request request=new Request.Builder().url("https://cdn.example/video").build();
        try(Response ignored=client.newCall(request).execute()){fail("Browser deadline must block native requests");}catch(MediaRateLimit.Limited expected){}
        assertEquals(0,calls.get());clock.set(25000);
        try(Response response=client.newCall(request).execute()){assertEquals(200,response.code());}
        assertEquals(1,calls.get());
    }
    private OkHttpClient client(MediaRateLimit limiter){return new OkHttpClient.Builder().dns(h->Collections.singletonList(InetAddress.getLoopbackAddress())).addInterceptor(limiter).build();}
}
