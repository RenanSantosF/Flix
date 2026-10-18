package com.renansantos.flix;

import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PopupBlockingTest {
    private String clip() throws Exception {
        try (java.io.InputStream stream = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("clip.base64")) {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int read;
            while ((read = stream.read(buffer)) != -1) bytes.write(buffer, 0, read);
            return bytes.toString("UTF-8").trim();
        }
    }
    private ActivityScenario<MainActivity> launch() {
        Context context = ApplicationProvider.getApplicationContext();
        Intent intent = new Intent(context, MainActivity.class).putExtra(MainActivity.EXTRA_SELF_TEST, true);
        return ActivityScenario.launch(intent);
    }
    private String js(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.testBrowser().evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        assertTrue("JavaScript callback timed out", done.await(5, TimeUnit.SECONDS));
        return result.get();
    }
    private void waitForJs(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        long end = SystemClock.uptimeMillis() + 15000;
        while (SystemClock.uptimeMillis() < end) {
            if ("true".equals(js(scenario, script))) return;
            SystemClock.sleep(150);
        }
        AtomicReference<String> diagnostics = new AtomicReference<>("");
        scenario.onActivity(a->diagnostics.set(a.mediaDebugState()));
        fail("Condition did not become true: " + script + "; " + diagnostics.get() + "; " + js(scenario,"JSON.stringify({observer:!!window.__flixMediaObserver,bridge:!!window.FlixMedia,video:document.querySelector('video')?{time:document.querySelector('video').currentTime,paused:document.querySelector('video').paused}:null})"));
    }
    private void load(ActivityScenario<MainActivity> scenario, String html) throws Exception {
        scenario.onActivity(activity -> activity.loadTestHtml(html));
        waitForJs(scenario, "document.readyState === 'complete' && document.title === 'Popup test'");
    }
    private void tap(ActivityScenario<MainActivity> scenario, int cssX, int cssY) {
        AtomicReference<float[]> coordinates = new AtomicReference<>();
        scenario.onActivity(activity -> {
            WebView view = activity.testBrowser();
            int[] origin = new int[2]; view.getLocationOnScreen(origin);
            float density = activity.getResources().getDisplayMetrics().density;
            coordinates.set(new float[]{origin[0] + cssX * density, origin[1] + cssY * density});
        });
        float[] xy = coordinates.get(); long now = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, xy[0], xy[1], 0);
        MotionEvent up = MotionEvent.obtain(now, now + 100, MotionEvent.ACTION_UP, xy[0], xy[1], 0);
        InstrumentationRegistry.getInstrumentation().sendPointerSync(down);
        InstrumentationRegistry.getInstrumentation().sendPointerSync(up);
        down.recycle(); up.recycle();
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }
    private int count(ActivityScenario<MainActivity> scenario, boolean popup) {
        AtomicReference<Integer> value = new AtomicReference<>(0);
        scenario.onActivity(a -> value.set(popup ? a.popupCount() : a.navigationCount()));
        return value.get();
    }
    private void waitForCount(ActivityScenario<MainActivity> scenario, boolean popup, int minimum) {
        long end = SystemClock.uptimeMillis() + 5000;
        while (SystemClock.uptimeMillis() < end) {
            if (count(scenario, popup) >= minimum) return;
            SystemClock.sleep(100);
        }
        assertTrue("Expected block counter >= " + minimum, count(scenario, popup) >= minimum);
    }

    @Test public void blocksGesturePopupsFromMainDocumentAndIframe() throws Exception {
        try (ActivityScenario<MainActivity> scenario = launch()) {
            load(scenario, "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><body style='margin:0'><button style='width:100%;height:64px' onclick=\"window.open('https://asiafilm.org/ad','_blank')\">Main popup</button><iframe style='position:absolute;left:0;top:100px;width:100%;height:80px;border:0' srcdoc=\"<meta name='viewport' content='width=device-width,initial-scale=1'><body style='margin:0'><button style='width:100%;height:64px' onclick=&quot;window.open('https://linkonclick.com/ad','_blank')&quot;>Iframe popup</button>\"></iframe>");
            tap(scenario, 50, 32); waitForCount(scenario, true, 1);
            tap(scenario, 50, 132); waitForCount(scenario, true, 2);
            assertEquals("\"Popup test\"", js(scenario, "document.title"));
            assertEquals("1", js(scenario, "document.querySelectorAll('iframe').length"));
        }
    }

    @Test public void asynchronousPopupHandshakeContinuesWithoutOpeningAnAd() throws Exception {
        try (ActivityScenario<MainActivity> scenario = launch()) {
            load(scenario, "<!doctype html><title>Popup test</title><script>window.providerReady=false;setTimeout(function(){var popup=window.open('https://asiafilm.org/ad','_blank');window.providerReady=!!popup;},500);</script>");
            waitForCount(scenario, true, 1);
            waitForJs(scenario, "window.providerReady===true");
            assertEquals("\"Popup test\"", js(scenario, "document.title"));
            assertEquals("true", js(scenario, "location.origin==='https://flix-ebon-ten.vercel.app'"));
        }
    }

    @Test public void providerDependencyLoadsAndVideoPlaysWhileItsPopupIsContained() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            scenario.onActivity(a->a.playerTestBootstrap("window.bootstrapReady=true;window.startProvider=function(){window.open('https://asiafilm.org/ad','_blank');document.querySelector('video').play();};"));
            load(scenario,"<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><script src='https://asiafilm.org/flix-player-test.js'></script><body style='margin:0'><button style='height:64px;width:100%' onclick='startProvider()'>Play</button><video muted loop playsinline src='data:video/mp4;base64,"+clip()+"'></video>");
            waitForJs(scenario,"window.bootstrapReady===true");tap(scenario,50,32);waitForCount(scenario,true,1);
            waitForJs(scenario,"!document.querySelector('video').paused && document.querySelector('video').currentTime>0.2");
            assertEquals("\"Popup test\"",js(scenario,"document.title"));
        }
    }

    @Test public void blocksRedirectsAndExternalAppSchemes() throws Exception {
        try (ActivityScenario<MainActivity> scenario = launch()) {
            load(scenario, "<!doctype html><title>Popup test</title><body>Navigation test</body>");
            js(scenario, "location.href='https://outside.example/advertising';true");
            waitForCount(scenario, false, 1);
            assertEquals("\"Popup test\"", js(scenario, "document.title"));
            js(scenario, "location.href='intent://advertising/#Intent;scheme=test;end';true");
            waitForCount(scenario, false, 2);
            assertEquals("\"Popup test\"", js(scenario, "document.title"));
        }
    }

    @Test public void videoKeepsPlayingAfterPopupIsBlocked() throws Exception {
        try (ActivityScenario<MainActivity> scenario = launch()) {
            String clip;
            try (java.io.InputStream stream = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("clip.base64")) {
                java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
                byte[] buffer = new byte[4096]; int read;
                while ((read = stream.read(buffer)) != -1) bytes.write(buffer, 0, read);
                clip = bytes.toString("UTF-8").trim();
            }
            load(scenario, "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><body style='margin:0'><button style='width:100%;height:64px' onclick=\"document.querySelector('video').play();window.open('https://asiafilm.org/ad','_blank')\">Play</button><video muted loop playsinline style='width:100%' src='data:video/mp4;base64," + clip + "'></video>");
            tap(scenario, 50, 32); waitForCount(scenario, true, 1);
            waitForJs(scenario, "!document.querySelector('video').paused && document.querySelector('video').currentTime > 0.2");
            assertEquals("\"Popup test\"", js(scenario, "document.title"));
        }
    }

    @Test public void reportsRealMediaPositionAndRestoresSavedPosition() throws Exception {
        try (ActivityScenario<MainActivity> scenario = launch()) {
            load(scenario, "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><body style='margin:0'><button style='width:100%;height:64px' onclick=\"document.querySelector('video').play()\">Play</button><video muted loop playsinline src='data:video/mp4;base64," + clip() + "'></video><script>window.lastProgress=null;window.addEventListener('flix:progress',function(e){window.lastProgress=e.detail;});</script>");
            waitForJs(scenario, "!!window.FlixControl");
            waitForJs(scenario, "!!window.__flixMediaObserver");
            js(scenario, "FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1,resume:0.65}));true");
            tap(scenario, 50, 32);
            waitForJs(scenario, "window.lastProgress && window.lastProgress.key==='movie:603' && window.lastProgress.position>=0.65 && window.lastProgress.playing");
            js(scenario, "document.querySelector('video').pause();true");
            waitForJs(scenario, "window.lastProgress && !window.lastProgress.playing");
        }
    }

    @Test public void videoContinuesInPictureInPictureWhenLeavingTheApp() throws Exception {
        try (ActivityScenario<MainActivity> scenario = launch()) {
            load(scenario, "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><style>.flix-pip video{position:fixed;inset:0;width:100vw;height:100vh;background:black;}</style><body style='margin:0'><button style='width:100%;height:64px' onclick=\"document.querySelector('video').play()\">Play</button><video muted loop playsinline src='data:video/mp4;base64," + clip() + "'></video>");
            waitForJs(scenario, "!!window.FlixControl");
            waitForJs(scenario, "!!window.__flixMediaObserver");
            js(scenario, "FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1,resume:0}));true");
            tap(scenario, 50, 32);
            waitForJs(scenario, "document.querySelector('video').currentTime>0.2");
            long deadline=SystemClock.uptimeMillis()+5000;
            AtomicReference<Boolean> active=new AtomicReference<>(false);
            while(SystemClock.uptimeMillis()<deadline){scenario.onActivity(a->active.set(a.isPlaybackActive()));if(active.get())break;SystemClock.sleep(100);}
            assertTrue("Native media observer must detect playback",active.get());
            // Real Android Home key exercises onUserLeaveHint, not just the explicit PiP button.
            InstrumentationRegistry.getInstrumentation().getUiAutomation().performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME);
            AtomicReference<Boolean> pip=new AtomicReference<>(false);deadline=SystemClock.uptimeMillis()+8000;
            while(SystemClock.uptimeMillis()<deadline){scenario.onActivity(a->pip.set(a.isInPictureInPictureMode()));if(pip.get())break;SystemClock.sleep(150);}
            assertTrue("Activity must enter PiP",pip.get());
            waitForJs(scenario, "!document.querySelector('video').paused && document.body.classList.contains('flix-pip')");
        }
    }

    @Test public void liveDurationEnablesPipWithoutRestoringVodPosition() throws Exception {
        try (ActivityScenario<MainActivity> scenario = launch()) {
            // Real clip playback, with the infinite duration metadata used by live streams.
            load(scenario, "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><body style='margin:0'><button style='width:100%;height:64px' onclick=\"document.querySelector('video').play()\">Play</button><video muted loop playsinline src='data:video/mp4;base64," + clip() + "'></video><script>var v=document.querySelector('video');Object.defineProperty(v,'duration',{get:function(){return Infinity;}});window.lastProgress=null;window.addEventListener('flix:progress',function(e){window.lastProgress=e.detail;});</script>");
            waitForJs(scenario, "!!window.FlixControl && !!window.__flixMediaObserver");
            js(scenario, "FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1,resume:0}));true");
            tap(scenario, 50, 32);
            waitForJs(scenario, "!document.querySelector('video').paused && document.querySelector('video').currentTime>0.2");
            assertEquals("null", js(scenario, "window.lastProgress"));
            js(scenario, "FlixControl.postMessage(JSON.stringify({type:'context',key:'live:channel-test',season:1,episode:1,resume:100}));true");
            waitForJs(scenario, "window.lastProgress && window.lastProgress.key==='live:channel-test' && window.lastProgress.live && window.lastProgress.duration===0 && window.lastProgress.playing");
            js(scenario, "FlixControl.postMessage(JSON.stringify({type:'pip'}));true");
            AtomicReference<Boolean> pip=new AtomicReference<>(false);long deadline=SystemClock.uptimeMillis()+8000;
            while(SystemClock.uptimeMillis()<deadline){scenario.onActivity(a->pip.set(a.isInPictureInPictureMode()));if(pip.get())break;SystemClock.sleep(150);}
            assertTrue("Live playback must enter PiP",pip.get());
            waitForJs(scenario, "!document.querySelector('video').paused");
        }
    }

    @Test public void rejectedHtmlSourceRecoversWithNativeVideoResumeAndPip() throws Exception {
        try (ActivityScenario<MainActivity> scenario = launch()) {
            final byte[] bytes;
            try(java.io.InputStream stream=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("recovery-clip.base64")) {
                java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;
                while((n=stream.read(buffer))!=-1)output.write(buffer,0,n);
                bytes=android.util.Base64.decode(output.toByteArray(),android.util.Base64.DEFAULT);
            }
            scenario.onActivity(a->a.nativeTestClip(bytes));
            load(scenario,"<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><body style='margin:0'><button style='height:64px;width:100%' onclick=\"document.querySelector('source').src='https://flix-ebon-ten.vercel.app/test-media.mp4';document.querySelector('video').load();\">Play unsupported HTML source</button><video><source type='video/not-supported'></video><script>window.lastProgress=null;window.addEventListener('flix:progress',function(e){window.lastProgress=e.detail;});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.__flixMediaObserver");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1,resume:0.65}));true");
            tap(scenario,50,32);
            waitForJs(scenario,"window.lastProgress && window.lastProgress.playing && window.lastProgress.position>=0.65");
            AtomicReference<Boolean> open=new AtomicReference<>(false);scenario.onActivity(a->open.set(a.isNativePlaybackOpen()));assertTrue("Native recovery must open",open.get());
            saveScreenshot("Flix-recuperacao-nativa.png");
            scenario.onActivity(a->a.enterPlayerPip());
            AtomicReference<Boolean> pip=new AtomicReference<>(false);long end=SystemClock.uptimeMillis()+6000;
            while(SystemClock.uptimeMillis()<end){scenario.onActivity(a->pip.set(a.isInPictureInPictureMode()));if(pip.get())break;SystemClock.sleep(100);}
            assertTrue("Native recovery must support PiP",pip.get());
        }
    }

    @Test public void failedBlobRecoversFromObservedHlsAndReportsSafeDiagnostics() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            final byte[] bytes;
            try(java.io.InputStream stream=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("recovery-hls.base64")) {
                java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;
                while((n=stream.read(buffer))!=-1)output.write(buffer,0,n);
                bytes=android.util.Base64.decode(output.toByteArray(),android.util.Base64.DEFAULT);
            }
            scenario.onActivity(a->a.nativeTestHls(bytes));
            load(scenario,"<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><video></video><script>window.lastProgress=null;window.lastDiagnostic='';window.addEventListener('flix:progress',function(e){window.lastProgress=e.detail});window.addEventListener('flix:diagnostic',function(e){window.lastDiagnostic=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.__flixMediaObserver");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1,resume:0.65}));true");
            js(scenario,"document.querySelector('video').src=URL.createObjectURL(new Blob(['invalid video'],{type:'video/mp4'}));setTimeout(function(){fetch('/test-stream.m3u8').then(function(r){return r.text()})},100);true");
            waitForJs(scenario,"window.lastProgress && window.lastProgress.playing && window.lastProgress.position>=0.65");
            assertEquals("true",js(scenario,"window.lastDiagnostic.indexOf("+org.json.JSONObject.quote("Flix "+BuildConfig.VERSION_NAME+" ("+BuildConfig.VERSION_CODE+")")+")>=0 && window.lastDiagnostic.indexOf('fonte blob')>=0 && window.lastDiagnostic.indexOf('test-stream')<0"));
            AtomicReference<Boolean> open=new AtomicReference<>(false);scenario.onActivity(a->open.set(a.isNativePlaybackOpen()));assertTrue(open.get());
            saveScreenshot("Flix-recuperacao-blob.png");
        }
    }

    @Test public void extensionlessHlsWithIncorrectHtmlMimeRecoversByInspectingRealDecoderBytes() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            final byte[] bytes;
            try(java.io.InputStream stream=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("recovery-hls.base64")) {
                java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;
                while((n=stream.read(buffer))!=-1)output.write(buffer,0,n);
                bytes=android.util.Base64.decode(output.toByteArray(),android.util.Base64.DEFAULT);
            }
            scenario.onActivity(a->a.nativeTestHls(bytes));
            load(scenario,"<!doctype html><title>Popup test</title><script>window.lastProgress=null;window.lastNotice='';window.addEventListener('flix:progress',function(e){window.lastProgress=e.detail});window.addEventListener('flix:notice',function(e){window.lastNotice=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.FlixMedia");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1,resume:0.65}));true");
            js(scenario,"FlixMedia.postMessage(JSON.stringify({videoId:'opaque:1',error:4,position:0,duration:0,source:'https://flix-ebon-ten.vercel.app/test-stream?token=private',sourceType:'video/mp4',sourceKind:'https'}));true");
            waitForJs(scenario,"window.lastProgress && window.lastProgress.playing && window.lastProgress.position>=0.65");
            AtomicReference<Boolean> open=new AtomicReference<>(false);scenario.onActivity(a->open.set(a.isNativePlaybackOpen()));assertTrue(open.get());
            assertEquals("\"\"",js(scenario,"window.lastNotice"));
            saveScreenshot("Flix-recuperacao-sem-extensao.png");
        }
    }

    @Test public void repeatedBrowserErrorCannotOverwriteNativeFailureOrRestartItsSource() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            scenario.onActivity(a->a.nativeTestClip("<!doctype html><html>Invalid media</html>".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            load(scenario,"<!doctype html><title>Popup test</title><script>window.lastNotice='';window.lastDiagnostic='';window.errors=0;window.addEventListener('flix:notice',function(e){window.lastNotice=e.detail});window.addEventListener('flix:diagnostic',function(e){window.lastDiagnostic=e.detail});window.addEventListener('flix:progress',function(e){if(e.detail.error)window.errors++});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.FlixMedia");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));true");
            String message="FlixMedia.postMessage(JSON.stringify({videoId:'failure:1',error:4,position:0,duration:0,source:'https://flix-ebon-ten.vercel.app/test-media.mp4?token=private',sourceKind:'https'}));true";
            js(scenario,message);
            waitForJs(scenario,"window.lastDiagnostic.indexOf('Formato: página HTML')>=0");
            String original=js(scenario,"window.lastDiagnostic");
            js(scenario,message);SystemClock.sleep(500);
            assertEquals(original,js(scenario,"window.lastDiagnostic"));assertEquals("0",js(scenario,"window.errors"));
            assertEquals("true",js(scenario,"window.lastDiagnostic.indexOf('token=')<0 && window.lastDiagnostic.indexOf('test-media.mp4')<0"));
            AtomicReference<Boolean> open=new AtomicReference<>(true);scenario.onActivity(a->open.set(a.isNativePlaybackOpen()));assertFalse(open.get());
        }
    }

    @Test public void nativeRecoveryFollows302ToHttpAndDecodesVideo() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            final byte[] bytes;
            try(java.io.InputStream stream=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("recovery-clip.base64")) {
                java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;
                while((n=stream.read(buffer))!=-1)output.write(buffer,0,n);bytes=android.util.Base64.decode(output.toByteArray(),android.util.Base64.DEFAULT);
            }
            scenario.onActivity(a->a.nativeTestRedirectClip(bytes));
            load(scenario,"<!doctype html><title>Popup test</title><script>window.lastProgress=null;window.lastNotice='';window.addEventListener('flix:progress',function(e){window.lastProgress=e.detail});window.addEventListener('flix:notice',function(e){window.lastNotice=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.FlixMedia");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1,resume:0.65}));true");
            js(scenario,"FlixMedia.postMessage(JSON.stringify({videoId:'redirect:1',error:4,position:0,duration:0,source:'https://flix-ebon-ten.vercel.app/test-redirect.mp4',sourceKind:'https'}));true");
            waitForJs(scenario,"window.lastProgress && window.lastProgress.playing && window.lastProgress.position>=0.65");
            AtomicReference<Boolean> open=new AtomicReference<>(false);AtomicReference<Integer> redirects=new AtomicReference<>(0);
            scenario.onActivity(a->{open.set(a.isNativePlaybackOpen());redirects.set(a.nativeTestRedirectCount());});
            assertTrue(open.get());assertTrue(redirects.get()>0);
            assertTrue(android.security.NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted("cdn.provider.example"));
            saveScreenshot("Flix-recuperacao-302.png");
        }
    }

    @Test public void rateLimitWaitsForRetryAfterThenAutomaticallyPlaysOnce() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            final byte[] bytes;
            try(java.io.InputStream stream=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("recovery-clip.base64")) {
                java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=stream.read(buffer))!=-1)output.write(buffer,0,n);
                bytes=android.util.Base64.decode(output.toByteArray(),android.util.Base64.DEFAULT);
            }
            scenario.onActivity(a->a.nativeTestRateLimitClip(bytes,2,false));
            load(scenario,"<!doctype html><title>Popup test</title><script>window.lastProgress=null;window.lastNotice='';window.addEventListener('flix:progress',function(e){window.lastProgress=e.detail});window.addEventListener('flix:notice',function(e){window.lastNotice=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.FlixMedia");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1,resume:0}));true");
            long start=SystemClock.elapsedRealtime();
            js(scenario,"FlixMedia.postMessage(JSON.stringify({videoId:'limit:1',error:4,position:0,duration:0,source:'https://rate-fixture.example/video.mp4',sourceKind:'https'}));true");
            waitForJs(scenario,"window.lastNotice.indexOf('HTTP 429')>=0");
            AtomicReference<Integer> count=new AtomicReference<>(0);scenario.onActivity(a->count.set(a.nativeTestLimitedCount()));assertEquals(1,(int)count.get());
            saveScreenshot("Flix-espera-429.png");
            waitForJs(scenario,"window.lastProgress && window.lastProgress.playing && window.lastProgress.position>=0");
            assertTrue(SystemClock.elapsedRealtime()-start>=2000);
            scenario.onActivity(a->count.set(a.nativeTestLimitedCount()));assertEquals(2,(int)count.get());
            waitForJs(scenario,"window.lastNotice===''");saveScreenshot("Flix-recuperacao-429.png");
        }
    }

    @Test public void longCooldownSurvivesAPlaybackContextReloadWithoutAnotherRequest() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            scenario.onActivity(a->a.nativeTestRateLimitClip(new byte[0],3600,true));
            load(scenario,"<!doctype html><title>Popup test</title><script>window.lastNotice='';window.addEventListener('flix:notice',function(e){window.lastNotice=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.FlixMedia");
            String context="FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));true";
            String media="FlixMedia.postMessage(JSON.stringify({videoId:'long-limit:1',error:4,position:0,duration:0,source:'https://long-rate-fixture.example/video.mp4',sourceKind:'https'}));true";
            js(scenario,context);js(scenario,media);waitForJs(scenario,"window.lastNotice.indexOf('HTTP 429')>=0");
            AtomicReference<Integer> count=new AtomicReference<>(0);scenario.onActivity(a->count.set(a.nativeTestLimitedCount()));assertEquals(1,(int)count.get());
            js(scenario,"window.lastNotice='';true");js(scenario,context);js(scenario,media);waitForJs(scenario,"window.lastNotice.indexOf('HTTP 429')>=0");
            scenario.onActivity(a->count.set(a.nativeTestLimitedCount()));assertEquals(1,(int)count.get());
        }
    }

    private byte[] recoveryClip() throws Exception {
        try(java.io.InputStream stream=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("recovery-clip.base64")) {
            java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] b=new byte[4096];int n;
            while((n=stream.read(b))!=-1)out.write(b,0,n);
            return android.util.Base64.decode(out.toByteArray(),android.util.Base64.DEFAULT);
        }
    }
    @Test public void stalledProviderShowsSanitizedWebViewEvidenceWithoutStartingNativeOrReloading() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            scenario.onActivity(a->a.testStallDelay(1500));
            load(scenario,"<!doctype html><title>Popup test</title><script>window.lastDiagnostic='';window.addEventListener('flix:diagnostic',function(e){lastDiagnostic=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.FlixMedia");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));FlixMedia.postMessage(JSON.stringify({videoId:'state:1',event:'state',source:'https://media.example/private?token=secret',sourceKind:'https',adLoading:true,readyState:0,networkState:2,position:0,duration:0,error:0}));console.error('Mixed Content: insecure video blocked https://cdn.example/private?token=secret');setTimeout(function(){var popup=null;popup.closed;},0);true");
            waitForJs(scenario,"lastDiagnostic.indexOf('sem reprodução')>=0");
            assertEquals("true",js(scenario,"lastDiagnostic.indexOf('TypeError: null.closed')>=0 && lastDiagnostic.indexOf('media.example')>=0 && lastDiagnostic.indexOf('Loading ad')>=0 && lastDiagnostic.indexOf('readyState 0')>=0 && lastDiagnostic.indexOf('networkState 2')>=0 && lastDiagnostic.indexOf('conteúdo HTTP bloqueado')>=0 && lastDiagnostic.indexOf('token')<0 && lastDiagnostic.indexOf('cdn.example')<0"));
            AtomicReference<Integer> opens=new AtomicReference<>(-1);scenario.onActivity(a->opens.set(a.nativeOpenCount()));assertEquals(0,(int)opens.get());
        }
    }

    @Test public void providerRecoversTemporaryHtmlFailureWithoutOpeningNativePlayer() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            byte[] clip=recoveryClip();String video=android.util.Base64.encodeToString(clip,android.util.Base64.NO_WRAP);
            scenario.onActivity(a->a.nativeTestClip(clip));
            load(scenario,"<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><button style='height:64px;width:100%' onclick=\"var v=document.querySelector('video');document.querySelector('source').src='https://flix-ebon-ten.vercel.app/temporary.mp4';v.load();v.play().catch(function(){});setTimeout(function(){v.innerHTML='';v.src='data:video/mp4;base64,"+video+"';v.load();v.play().catch(function(){});},1500);\">Assistir</button><video controls playsinline><source type='video/not-supported'></video><script>window.htmlErrors=0;document.addEventListener('error',function(e){if(e.target.tagName==='SOURCE'||e.target.tagName==='VIDEO')htmlErrors++;},true);window.lastProgress=null;window.lastDiagnostic='';window.addEventListener('flix:progress',function(e){lastProgress=e.detail});window.addEventListener('flix:diagnostic',function(e){lastDiagnostic=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.__flixMediaObserver");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));true");tap(scenario,50,32);
            waitForJs(scenario,"lastProgress && lastProgress.playing && lastProgress.position>=2");
            // Pass the grace deadline: a stale timer must not steal recovered playback.
            SystemClock.sleep(3500);
            AtomicReference<Integer> opens=new AtomicReference<>(-1);AtomicReference<Boolean> nativeOpen=new AtomicReference<>(true);
            scenario.onActivity(a->{opens.set(a.nativeOpenCount());nativeOpen.set(a.isNativePlaybackOpen());});
            assertEquals(0,(int)opens.get());assertFalse(nativeOpen.get());
            assertEquals("true",js(scenario,"htmlErrors>0 && !document.querySelector('video').paused && document.querySelector('video').currentTime>4 && lastDiagnostic.indexOf('motor nativo')<0"));
            saveScreenshot("Flix-recuperacao-do-proprio-player.png");
        }
    }

    @Test public void nativeHandoffUnloadsProviderBeforePlayingAndKeepsAppProgressAlive() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            byte[] clip=recoveryClip();
            scenario.onActivity(a->{a.nativeTestClip(clip);a.testChildHtml("<!doctype html><script>setInterval(function(){fetch('/test-browser-pull')},100)</script>");});
            load(scenario,"<!doctype html><title>Popup test</title><div id='player-frame'><iframe></iframe></div><script>window.lastProgress=null;window.parentTicks=0;window.sessionEvents=[];setInterval(function(){parentTicks++},100);window.addEventListener('flix:progress',function(e){lastProgress=e.detail});window.addEventListener('flix:native-session',function(e){sessionEvents.push(e.detail.active)});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.FlixMedia");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1,resume:0.65}));document.querySelector('iframe').src='/android-test-frame';true");
            SystemClock.sleep(750);
            AtomicReference<Integer> pulls=new AtomicReference<>(0);scenario.onActivity(a->pulls.set(a.browserPullCount()));assertTrue(pulls.get()>0);
            js(scenario,"FlixMedia.postMessage(JSON.stringify({videoId:'exclusive:1',error:4,position:0,duration:0,source:'https://flix-ebon-ten.vercel.app/test-media.mp4',sourceKind:'https'}));true");
            waitForJs(scenario,"lastProgress && lastProgress.playing && lastProgress.position>=0.65");
            assertEquals("true",js(scenario,"document.querySelector('iframe').contentWindow.location.href==='about:blank' && sessionEvents[0]===true"));
            SystemClock.sleep(300);scenario.onActivity(a->pulls.set(a.browserPullCount()));int stopped=pulls.get();
            int ticks=Integer.parseInt(js(scenario,"parentTicks"));SystemClock.sleep(600);
            scenario.onActivity(a->pulls.set(a.browserPullCount()));assertEquals(stopped,(int)pulls.get());assertTrue(Integer.parseInt(js(scenario,"parentTicks"))>ticks);
            scenario.onActivity(a->a.onBackPressed());waitForJs(scenario,"sessionEvents[sessionEvents.length-1]===false");
            assertEquals("true",js(scenario,"document.querySelector('iframe').contentWindow.location.href==='about:blank'"));
            SystemClock.sleep(300);scenario.onActivity(a->pulls.set(a.browserPullCount()));assertEquals(stopped,(int)pulls.get());
            saveScreenshot("Flix-transferencia-exclusiva.png");
        }
    }
    @Test public void browser429WithoutPlayIntentNeverStartsNativeOrRetries() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            byte[] clip=recoveryClip();
            scenario.onActivity(a->{a.getSharedPreferences("media-cooldowns",android.content.Context.MODE_PRIVATE).edit().clear().commit();a.nativeSharedRateClip(clip);a.testChildHtml("<!doctype html><video src='/test-web-limit.mp4'></video>");});
            load(scenario,"<!doctype html><title>Popup test</title><div id='player-frame'><iframe></iframe></div><script>window.lastProgress=null;window.lastNotice='';window.addEventListener('flix:progress',function(e){lastProgress=e.detail});window.addEventListener('flix:notice',function(e){lastNotice=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.FlixMedia");
            long start=SystemClock.elapsedRealtime();
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));document.querySelector('iframe').src='/android-test-frame';true");
            waitForJs(scenario,"lastNotice.indexOf('HTTP 429')>=0");
            AtomicReference<Integer> browserCount=new AtomicReference<>(0),nativeCount=new AtomicReference<>(0);
            scenario.onActivity(a->{browserCount.set(a.browserLimitCount());nativeCount.set(a.sharedNativePullCount());});
            assertEquals(1,(int)browserCount.get());assertEquals(0,(int)nativeCount.get());
            SystemClock.sleep(8500);
            scenario.onActivity(a->{browserCount.set(a.browserLimitCount());nativeCount.set(a.sharedNativePullCount());});
            assertEquals(1,(int)browserCount.get());assertEquals(0,(int)nativeCount.get());
            assertEquals("true",js(scenario,"document.querySelector('iframe').contentWindow.location.href!=='about:blank' && !lastProgress"));
        }
    }

    @Test public void browser429RetriesAfterServerDeadlineAndPlaysInTheSameDocument() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            byte[] clip=recoveryClip();
            scenario.onActivity(a->{a.getSharedPreferences("media-cooldowns",android.content.Context.MODE_PRIVATE).edit().clear().commit();a.testWebRetryClip(clip,false);});
            // Model the provider state observed in Chrome: null error, loading network,
            // play still requested. The final assertion requires real video time to advance.
            load(scenario,"<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><button style='width:100%;height:64px' onclick=\"var v=document.querySelector('video');Object.defineProperty(v,'error',{get:function(){return null},configurable:true});Object.defineProperty(v,'networkState',{get:function(){return 2},configurable:true});Object.defineProperty(v,'paused',{get:function(){return false},configurable:true});v.src='/test-web-retry.mp4';v.play().catch(function(){});\">Assistir</button><video controls playsinline></video><script>window.lastProgress=null;window.lastNotice='';window.ticks=0;setInterval(function(){ticks++},100);window.addEventListener('flix:progress',function(e){lastProgress=e.detail});window.addEventListener('flix:notice',function(e){lastNotice=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.__flixMediaObserver");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));true");
            long start=SystemClock.elapsedRealtime();tap(scenario,50,32);
            waitForJs(scenario,"lastNotice.indexOf('HTTP 429')>=0");
            AtomicReference<Integer> requests=new AtomicReference<>(0),opens=new AtomicReference<>(0);
            scenario.onActivity(a->requests.set(a.testWebRetryCount()));assertEquals(1,(int)requests.get());
            waitForJs(scenario,"lastProgress && lastProgress.playing && lastProgress.position>0.1");
            assertTrue(SystemClock.elapsedRealtime()-start>=2000);
            scenario.onActivity(a->{requests.set(a.testWebRetryCount());opens.set(a.nativeOpenCount());});
            assertEquals(2,(int)requests.get());assertEquals(0,(int)opens.get());
            assertEquals("true",js(scenario,"ticks>15 && document.querySelector('video').readyState>=3 && lastNotice===''") );
            saveScreenshot("Flix-retomada-WebView-429.png");
        }
    }
    @Test public void repeatedBrowser429DoesNotLoopOrOpenNativePlayback() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()) {
            scenario.onActivity(a->{a.getSharedPreferences("media-cooldowns",android.content.Context.MODE_PRIVATE).edit().clear().commit();a.testWebRetryClip(new byte[0],true);});
            load(scenario,"<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><title>Popup test</title><button style='width:100%;height:64px' onclick=\"var v=document.querySelector('video');v.src='/test-web-retry.mp4';v.play().catch(function(){});\">Assistir</button><video controls playsinline></video><script>window.lastNotice='';window.addEventListener('flix:notice',function(e){lastNotice=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.__flixMediaObserver");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));true");tap(scenario,50,32);
            waitForJs(scenario,"lastNotice.indexOf('repetições foram interrompidas')>=0");SystemClock.sleep(2500);
            AtomicReference<Integer> requests=new AtomicReference<>(0),opens=new AtomicReference<>(0);
            scenario.onActivity(a->{requests.set(a.testWebRetryCount());opens.set(a.nativeOpenCount());});
            assertEquals(2,(int)requests.get());assertEquals(0,(int)opens.get());
        }
    }

    private String retryingProviderFixture(){
        return "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><style>body{margin:0}</style><button style='width:100%;height:64px' onclick=\"var v=document.querySelector('video');v.src='/test-web-retry.mp4';v.play().catch(function(){});\">Assistir</button><video controls playsinline></video><script>var v=document.querySelector('video');v.addEventListener('error',function(){setTimeout(function(){v.load();v.play().catch(function(){});},50)});</script>";
    }
    private String gateParentFixture(){
        return "<!doctype html><title>Popup test</title><meta name='viewport' content='width=device-width,initial-scale=1'><style>body{margin:0}iframe{width:100%;height:400px;border:0}</style><div id='player-frame'><iframe src='/android-test-frame'></iframe></div><script>window.lastProgress=null;window.lastNotice='';window.stopped=false;window.ticks=0;setInterval(function(){ticks++},100);addEventListener('flix:progress',function(e){lastProgress=e.detail});addEventListener('flix:notice',function(e){lastNotice=e.detail});addEventListener('flix:provider-limited',function(){stopped=true;document.querySelector('iframe').src='about:blank'});</script>";
    }
    @Test public void providerErrorReloadWaitsBeforeConnectingAndPlaysWithoutDuplicateAppRetry() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()){
            byte[] clip=recoveryClip();scenario.onActivity(a->{a.getSharedPreferences("media-cooldowns",Context.MODE_PRIVATE).edit().clear().commit();a.testWebRetryClip(clip,false);a.testChildHtml(retryingProviderFixture());});
            load(scenario,gateParentFixture());waitForJs(scenario,"!!window.FlixControl && !!document.querySelector('iframe').contentWindow.__flixMediaObserver");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));true");
            long start=SystemClock.elapsedRealtime();tap(scenario,50,32);
            waitForJs(scenario,"lastNotice.indexOf('HTTP 429')>=0");
            SystemClock.sleep(700);AtomicReference<Integer> requests=new AtomicReference<>(0),held=new AtomicReference<>(0),opens=new AtomicReference<>(0);
            scenario.onActivity(a->{requests.set(a.testWebRetryCount());held.set(a.testHeldRequests());});assertEquals(1,(int)requests.get());assertEquals(1,(int)held.get());
            waitForJs(scenario,"lastProgress && lastProgress.playing && lastProgress.position>0.1");assertTrue(SystemClock.elapsedRealtime()-start>=2000);
            scenario.onActivity(a->{requests.set(a.testWebRetryCount());opens.set(a.nativeOpenCount());});assertEquals(2,(int)requests.get());assertEquals(0,(int)opens.get());
            assertEquals("true",js(scenario,"ticks>15 && !stopped && document.querySelector('iframe').contentWindow.document.querySelector('video').readyState>=3"));
            saveScreenshot("Flix-espera-da-repeticao-do-provedor.png");
        }
    }
    @Test public void providerRepeated429UnloadsItsRetryLoopAndKeepsAppResponsive() throws Exception {
        try(ActivityScenario<MainActivity> scenario=launch()){
            scenario.onActivity(a->{a.getSharedPreferences("media-cooldowns",Context.MODE_PRIVATE).edit().clear().commit();a.testWebRetryClip(new byte[0],true);a.testChildHtml(retryingProviderFixture());});
            load(scenario,gateParentFixture());waitForJs(scenario,"!!window.FlixControl && !!document.querySelector('iframe').contentWindow.__flixMediaObserver");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));true");tap(scenario,50,32);
            waitForJs(scenario,"stopped && lastNotice.indexOf('repetições foram interrompidas')>=0");SystemClock.sleep(2500);
            AtomicReference<Integer> requests=new AtomicReference<>(0),opens=new AtomicReference<>(0);scenario.onActivity(a->{requests.set(a.testWebRetryCount());opens.set(a.nativeOpenCount());});
            assertEquals(2,(int)requests.get());assertEquals(0,(int)opens.get());assertEquals("true",js(scenario,"ticks>30 && document.querySelector('iframe').contentWindow.location.href==='about:blank'"));
            saveScreenshot("Flix-repeticoes-interrompidas.png");
        }
    }

    @Test public void cooldownStoreRetainsOnlyHostAndDeadlineAcrossNewStoreInstances() {
        android.content.SharedPreferences preferences=ApplicationProvider.getApplicationContext().getSharedPreferences("rate-test-store",android.content.Context.MODE_PRIVATE);
        preferences.edit().clear().commit();long until=System.currentTimeMillis()+60000;
        new MediaCooldownStore(preferences).put("cdn.example",new MediaRateLimit.Deadline(until,true));
        MediaRateLimit.Deadline restored=new MediaCooldownStore(preferences).get("cdn.example");
        assertNotNull(restored);assertEquals(until,restored.until);assertTrue(restored.supplied);assertEquals(2,preferences.getAll().size());
        preferences.edit().clear().commit();
    }

    @Test public void unsupportedVideoWithoutHttpsSourceCannotInvokeNativeRecovery() throws Exception {
        try (ActivityScenario<MainActivity> scenario = launch()) {
            load(scenario,"<!doctype html><title>Popup test</title><script>window.lastProgress=null;window.lastDiagnostic='';window.addEventListener('flix:progress',function(e){window.lastProgress=e.detail;});window.addEventListener('flix:diagnostic',function(e){window.lastDiagnostic=e.detail});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.FlixMedia");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));true");
            js(scenario,"FlixMedia.postMessage(JSON.stringify({videoId:'bad:1',error:4,position:0,duration:0,source:'http://127.0.0.1/private.mp4'}));true");
            waitForJs(scenario,"window.lastProgress && window.lastProgress.error===4");
            assertEquals("true",js(scenario,"window.lastDiagnostic.indexOf('fonte não aceito')>=0 && window.lastDiagnostic.indexOf('127.0.0.1')<0 && window.lastDiagnostic.indexOf('private.mp4')<0"));
            AtomicReference<Boolean> open=new AtomicReference<>(true);scenario.onActivity(a->open.set(a.isNativePlaybackOpen()));assertFalse(open.get());
        }
    }

    @Test public void liveCatalogShowsThreeCompactPostersAndPersistsFavorites() throws Exception {
        org.junit.Assume.assumeTrue("Live UI runs after the production merge", "true".equals(InstrumentationRegistry.getArguments().getString("liveCatalog")));
        try (ActivityScenario<MainActivity> scenario = launch()) {
            scenario.onActivity(a->a.testBrowser().loadUrl(NavigationPolicy.HOME));
            waitForJs(scenario, "document.querySelectorAll('.poster-card').length>=3");
            assertEquals("true",js(scenario,"document.querySelector('.poster-card').getBoundingClientRect().width<=innerWidth/2.5 && document.documentElement.scrollWidth<=innerWidth+1"));
            waitForJs(scenario, "Array.from(document.querySelectorAll('.poster-art img')).slice(0,3).every(function(i){return i.complete&&i.naturalWidth>0;})");
            saveScreenshot("Flix-catalogo.png");
            js(scenario, "window.savedTitle=document.querySelector('.poster-card h3').textContent;document.querySelector('.poster-card .favorite-button').click();true");
            waitForJs(scenario, "document.querySelector('.poster-card .favorite-button').getAttribute('aria-pressed')==='true'");
            js(scenario, "document.querySelector('.bottom-nav a[href=\"/?view=list\"]').click();true");
            waitForJs(scenario, "!!document.querySelector('.page-heading h1') && document.querySelector('.page-heading h1').textContent.indexOf('Minha lista')>=0 && !!document.querySelector('.poster-grid .poster-card')");
            saveScreenshot("Flix-minha-lista.png");
            scenario.onActivity(a->a.testBrowser().reload());
            waitForJs(scenario, "document.querySelector('.poster-grid .favorite-button[aria-pressed=true]')!==null");
        }
    }

    @Test public void productionPlayerHasOneEpisodePickerAndTallServerArea() throws Exception {
        org.junit.Assume.assumeTrue("Production UI runs after merge", "true".equals(InstrumentationRegistry.getArguments().getString("liveCatalog")));
        try (ActivityScenario<MainActivity> scenario = launch()) {
            scenario.onActivity(a->a.testBrowser().loadUrl(NavigationPolicy.HOME + "titulo/tv/1396"));
            waitForJs(scenario, "document.querySelectorAll('.selectors select').length===2");
            assertEquals("0", js(scenario, "document.querySelectorAll('.episode-list,.player-options').length"));
            js(scenario, "document.querySelector('.player-cover button').click();true");
            waitForJs(scenario, "!!document.querySelector('.videoFrame.server-selection iframe')");
            assertEquals("true", js(scenario, "document.querySelector('.videoFrame').getBoundingClientRect().height>=390"));
            assertEquals("true", js(scenario, "document.querySelector('.videoFrame iframe').src.endsWith('#noEpList')"));
            saveScreenshot("Flix-player-ampliado.png");
        }
    }

    @Test public void productionLiveTabShowsCatalogOrExplicitProviderFailure() throws Exception {
        org.junit.Assume.assumeTrue("Production UI runs after merge", "true".equals(InstrumentationRegistry.getArguments().getString("liveCatalog")));
        try (ActivityScenario<MainActivity> scenario = launch()) {
            scenario.onActivity(a->a.testBrowser().loadUrl(NavigationPolicy.HOME + "ao-vivo"));
            waitForJs(scenario, "!!document.querySelector('.live-tabs')");
            waitForJs(scenario, "document.querySelectorAll('.live-placeholder').length===0");
            assertEquals("true", js(scenario, "document.documentElement.scrollWidth<=innerWidth+1 && document.querySelector('.bottom-nav a.active').textContent.indexOf('Ao vivo')>=0"));
            assertEquals("true", js(scenario, "document.querySelector('.live-update').textContent.length>0"));
            saveScreenshot("Flix-ao-vivo.png");
        }
    }

    private void saveScreenshot(String filename) throws Exception {
        android.graphics.Bitmap image=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(image);
        String additional=InstrumentationRegistry.getArguments().getString("additionalTestOutputDir");
        java.io.File folder=additional==null?InstrumentationRegistry.getInstrumentation().getContext().getExternalFilesDir("screenshots"):new java.io.File(additional);
        assertNotNull(folder);folder.mkdirs();
        try(java.io.FileOutputStream output=new java.io.FileOutputStream(new java.io.File(folder,filename))){image.compress(android.graphics.Bitmap.CompressFormat.PNG,100,output);}
        image.recycle();
    }
}
