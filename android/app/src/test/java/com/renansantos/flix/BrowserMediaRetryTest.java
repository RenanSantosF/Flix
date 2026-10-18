package com.renansantos.flix;
import org.junit.Test;
import static org.junit.Assert.*;
public class BrowserMediaRetryTest {
    @Test public void waitsForTheExactSourceAndNeverShortensRetryAfter(){
        BrowserMediaRetry retry=new BrowserMediaRetry();
        String source="https://cdn.example/movie?token=private";
        retry.limited(source,new MediaRateLimit.Deadline(21000,true));
        retry.limited(source,new MediaRateLimit.Deadline(1000,true));
        assertEquals(20000,retry.waitMillis(source,1000));
        assertEquals(-1,retry.waitMillis("https://cdn.example/another",1000));
        assertFalse(retry.consume(source,20999));assertTrue(retry.consume(source,21000));
        retry.limited("https://cdn.example/second",new MediaRateLimit.Deadline(22000,true));
        assertFalse(retry.consume(source,23000));assertFalse(retry.consume("https://cdn.example/second",23000));
    }
    @Test public void boundsAutomaticWaitAndResetsOnlyOnANewContext(){
        BrowserMediaRetry retry=new BrowserMediaRetry();String source="https://cdn.example/movie";
        retry.limited(source,new MediaRateLimit.Deadline(600001,true));
        assertEquals(-1,retry.waitMillis(source,0));assertTrue(retry.isLimited(source));
        retry.clear();assertFalse(retry.isLimited(source));
        retry.limited(source,new MediaRateLimit.Deadline(5000,true));
        assertTrue(retry.consume(source,5000));retry.succeeded();assertFalse(retry.isLimited(source));
        retry.limited(source,new MediaRateLimit.Deadline(6000,true));assertFalse(retry.consume(source,6000));
    }
    @Test public void aLaterLimitOnTheSameHostPostponesAnExistingSource(){
        BrowserMediaRetry retry=new BrowserMediaRetry();String source="https://cdn.example/first";
        retry.limited(source,new MediaRateLimit.Deadline(21000,true));
        retry.limited("https://cdn.example/another",new MediaRateLimit.Deadline(35000,true));
        assertEquals(34000,retry.waitMillis(source,1000));assertFalse(retry.consume(source,21000));
        assertTrue(retry.consume(source,35000));
    }
    @Test public void ignoresUnsafeSourcesAndDoesNotConfuseDifferentQueries(){
        BrowserMediaRetry retry=new BrowserMediaRetry();
        for(String source:new String[]{"http://cdn.example/movie","https://127.0.0.1/movie","data:video/mp4,abc"}){
            retry.limited(source,new MediaRateLimit.Deadline(1000,true));assertFalse(retry.isLimited(source));
        }
        retry.limited("https://cdn.example/video?token=a",new MediaRateLimit.Deadline(1000,true));
        assertFalse(retry.isLimited("https://cdn.example/video?token=b"));
    }
}
