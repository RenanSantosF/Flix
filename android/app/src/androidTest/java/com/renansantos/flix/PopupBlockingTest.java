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
        fail("Condition did not become true: " + script);
    }
    private void load(ActivityScenario<MainActivity> scenario, String html) throws Exception {
        scenario.onActivity(activity -> activity.testBrowser().loadDataWithBaseURL(NavigationPolicy.HOME + "android-test", html, "text/html", "UTF-8", null));
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
}
