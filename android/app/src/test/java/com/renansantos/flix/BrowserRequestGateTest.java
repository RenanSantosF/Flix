package com.renansantos.flix;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

public class BrowserRequestGateTest {
    private static final String MEDIA="https://cdn.example/movie.mp4?token=original";
    @Test public void unknownUrlsAndHealthyRangeRequestsPassImmediately(){
        BrowserRequestGate gate=new BrowserRequestGate(()->1000);
        gate.source(MEDIA);assertTrue(gate.await(MEDIA,()->fail("Healthy media must not wait")));
        gate.limited(MEDIA,new MediaRateLimit.Deadline(3000,true));
        assertTrue(gate.await("https://cdn.example/other.mp4",()->fail("Unrelated resource")));
        assertTrue(gate.await(MEDIA+"-another-token",()->fail("Exact URL only")));
    }
    @Test public void heldRequestReleasesAfterDeadlineAndOwnsTheOnlyRetry() throws Exception {
        AtomicLong now=new AtomicLong(1000);BrowserRequestGate gate=new BrowserRequestGate(now::get);
        gate.source(MEDIA);gate.limited(MEDIA,new MediaRateLimit.Deadline(3000,true));
        ExecutorService worker=Executors.newSingleThreadExecutor();CountDownLatch waiting=new CountDownLatch(1);
        try{
            Future<Boolean> result=worker.submit(()->gate.await(MEDIA,waiting::countDown));
            assertTrue(waiting.await(1,TimeUnit.SECONDS));assertFalse(result.isDone());assertTrue(gate.ownsRetry(MEDIA));
            now.set(2999);gate.visible(true);assertFalse(result.isDone());
            now.set(3000);gate.visible(true);assertTrue(result.get(1,TimeUnit.SECONDS));assertEquals(1,gate.held());
            gate.visible(false);assertTrue(gate.await(MEDIA,()->fail("Subsequent healthy range remains normal, including PiP")));gate.visible(true);
            assertTrue(gate.limited(MEDIA,new MediaRateLimit.Deadline(5000,true)));assertTrue(gate.terminal());
            assertFalse(gate.await(MEDIA,()->fail("Second refusal must not connect")));
        }finally{worker.shutdownNow();}
    }
    @Test public void changingSourceCancelsOldPendingRequestWithoutConsumingNewSourcesRetry() throws Exception {
        AtomicLong now=new AtomicLong(1000);BrowserRequestGate gate=new BrowserRequestGate(now::get);
        gate.source(MEDIA);gate.limited(MEDIA,new MediaRateLimit.Deadline(3000,true));
        ExecutorService worker=Executors.newSingleThreadExecutor();CountDownLatch waiting=new CountDownLatch(1);
        try{
            Future<Boolean> result=worker.submit(()->gate.await(MEDIA,waiting::countDown));assertTrue(waiting.await(1,TimeUnit.SECONDS));
            gate.source("https://cdn.example/next.mp4");assertFalse(gate.ownsRetry("https://cdn.example/next.mp4"));assertFalse(result.get(1,TimeUnit.SECONDS));
        }finally{worker.shutdownNow();}
    }
    @Test public void backgroundAndNewContextCancelWaitingWorkers() throws Exception {
        for(boolean background:new boolean[]{true,false}){
            BrowserRequestGate gate=new BrowserRequestGate(()->1000);gate.source(MEDIA);gate.limited(MEDIA,new MediaRateLimit.Deadline(3000,true));
            ExecutorService worker=Executors.newSingleThreadExecutor();CountDownLatch waiting=new CountDownLatch(1);
            try{
                Future<Boolean> result=worker.submit(()->gate.await(MEDIA,waiting::countDown));assertTrue(waiting.await(1,TimeUnit.SECONDS));
                if(background)gate.visible(false);else gate.clear();assertFalse(result.get(1,TimeUnit.SECONDS));
            }finally{worker.shutdownNow();}
        }
    }
    @Test public void first429CanArriveBeforeTheObserverAndLongWaitsNeverHoldAWorker(){
        BrowserRequestGate gate=new BrowserRequestGate(()->1000);
        assertFalse(gate.limited(MEDIA,new MediaRateLimit.Deadline(500000,true)));
        gate.source(MEDIA);assertTrue(gate.terminal());assertFalse(gate.await(MEDIA,()->fail("Long wait")));
        gate.clear();gate.source(MEDIA);assertFalse(gate.terminal());assertFalse(gate.ownsRetry(MEDIA));
    }
    @Test public void aLaterHostDeadlinePostponesTheAlreadyWaitingCurrentVideo() throws Exception {
        AtomicLong now=new AtomicLong(1000);BrowserRequestGate gate=new BrowserRequestGate(now::get);
        gate.source(MEDIA);gate.limited(MEDIA,new MediaRateLimit.Deadline(3000,true));
        ExecutorService worker=Executors.newSingleThreadExecutor();CountDownLatch waiting=new CountDownLatch(1);
        try{
            Future<Boolean> result=worker.submit(()->gate.await(MEDIA,waiting::countDown));assertTrue(waiting.await(1,TimeUnit.SECONDS));
            gate.limited("https://cdn.example/other.mp4",new MediaRateLimit.Deadline(5000,true));
            now.set(3000);gate.visible(true);assertFalse(result.isDone());
            now.set(5000);gate.visible(true);assertTrue(result.get(1,TimeUnit.SECONDS));
        }finally{worker.shutdownNow();}
    }
    @Test public void appInitiatedRetryAlsoCountsTowardSecondRefusal(){
        BrowserRequestGate gate=new BrowserRequestGate(()->1000);gate.source(MEDIA);gate.limited(MEDIA,new MediaRateLimit.Deadline(2000,true));
        gate.appRetry(MEDIA);assertTrue(gate.limited(MEDIA,new MediaRateLimit.Deadline(3000,true)));assertTrue(gate.terminal());
    }
}
