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

    @Test public void unsupportedVideoWithoutHttpsSourceCannotInvokeNativeRecovery() throws Exception {
        try (ActivityScenario<MainActivity> scenario = launch()) {
            load(scenario,"<!doctype html><title>Popup test</title><script>window.lastProgress=null;window.addEventListener('flix:progress',function(e){window.lastProgress=e.detail;});</script>");
            waitForJs(scenario,"!!window.FlixControl && !!window.FlixMedia");
            js(scenario,"FlixControl.postMessage(JSON.stringify({type:'context',key:'movie:603',season:1,episode:1}));true");
            js(scenario,"FlixMedia.postMessage(JSON.stringify({videoId:'bad:1',error:4,position:0,duration:0,source:'http://127.0.0.1/private.mp4'}));true");
            waitForJs(scenario,"window.lastProgress && window.lastProgress.error===4");
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
