package com.renansantos.flix;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.util.Rational;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public final class MainActivity extends Activity {
    static final String EXTRA_SELF_TEST = "flix.self_test";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayList<WebView> popupSinks = new ArrayList<>();
    private final AtomicInteger blockedPopups = new AtomicInteger();
    private final AtomicInteger blockedNavigations = new AtomicInteger();
    private final HashSet<String> restoredVideos = new HashSet<>();
    private WebView browser;
    private FrameLayout root, normal;
    private LinearLayout errorPanel;
    private ProgressBar progress;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private String lastAppUrl = NavigationPolicy.HOME, contextKey = "", activeVideo = "";
    private int contextSeason = 1, contextEpisode = 1;
    private double resumePosition;
    private boolean playbackActive, documentStartObserver, destroyed, enteringPip;
    private JavaScriptReplyProxy activeReply;
    private NativePlayback nativePlayback;
    private androidx.media3.datasource.DataSource.Factory nativeTestSource;
    private final HashSet<String> recoveredSources = new HashSet<>();
    private String observerScript = "";
    private String testHtml;
    private int mediaMessages;
    private String lastMediaOrigin = "";
    private boolean selfTest() { return BuildConfig.DEBUG && getIntent().getBooleanExtra(EXTRA_SELF_TEST, false); }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(11, 11, 15));
        normal = new FrameLayout(this);
        root.addView(normal, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (customView == null && !isInPictureInPictureMode()) view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            else view.setPadding(0, 0, 0, 0);
            return insets.consumeSystemWindowInsets();
        });
        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(11, 11, 15));
        normal.addView(browser, new FrameLayout.LayoutParams(-1, -1));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.rgb(244, 63, 98)));
        normal.addView(progress, new FrameLayout.LayoutParams(-1, dp(2), Gravity.TOP));
        createErrorPanel();
        configureBrowser();
        configureMediaBridge();
        nativePlayback = new NativePlayback(this, root, this::enterPlayerPip, new NativePlayback.Listener() {
            @Override public void progress(double position,double duration,boolean playing,boolean ended) {
                if(contextKey.isEmpty()||destroyed)return;
                playbackActive=playing;root.setKeepScreenOn(playing);updatePipParams();
                try {
                    JSONObject event=new JSONObject().put("key",contextKey).put("season",contextSeason).put("episode",contextEpisode)
                        .put("position",position).put("duration",duration).put("playing",playing).put("ended",ended);
                    browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:progress',{detail:"+event+"}))",null);
                } catch(Exception ignored) { }
            }
            @Override public void failed(String message) { notice(message); }
            @Override public void closed() { playbackActive=false;root.setKeepScreenOn(false);updatePipParams(); }
        });
        browser.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value); progress.setVisibility(value == 100 || isInPictureInPictureMode() ? View.GONE : View.VISIBLE);
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, Message resultMsg) {
                // Preserve the popup containment that already works on the user's device.
                blockedPopups.incrementAndGet();
                WebView sink = new WebView(MainActivity.this);
                sink.getSettings().setJavaScriptEnabled(false);
                sink.getSettings().setBlockNetworkLoads(true);
                sink.getSettings().setAllowFileAccess(false);
                sink.getSettings().setAllowContentAccess(false);
                sink.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) { return true; }
                    @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest request) { return emptyResponse(); }
                });
                if (popupSinks.size() >= 4) { WebView old = popupSinks.remove(0); old.destroy(); }
                popupSinks.add(sink);
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(sink);
                resultMsg.sendToTarget();
                handler.postDelayed(() -> { if (popupSinks.remove(sink)) sink.destroy(); }, 2000);
                return true;
            }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) { callback.onCustomViewHidden(); return; }
                customView = view; customViewCallback = callback;
                normal.setVisibility(View.GONE); root.setPadding(0, 0, 0, 0);
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                updatePipParams();
            }
            @Override public void onHideCustomView() { exitFullscreen(); }
        });
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                boolean allowed = request.isForMainFrame() ? NavigationPolicy.isAppUrl(url) : NavigationPolicy.canLoadSubframe(url);
                if (!allowed) noteBlockedNavigation();
                return !allowed;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Instrumentation uses a real HTTPS document origin, without weakening media checks.
                if (selfTest() && testHtml != null && request.isForMainFrame() && (NavigationPolicy.HOME + "android-test").equals(url))
                    return new WebResourceResponse("text/html", "UTF-8", new ByteArrayInputStream(testHtml.getBytes(StandardCharsets.UTF_8)));
                if (NavigationPolicy.isAdUrl(url) || (request.isForMainFrame() && !NavigationPolicy.isAppUrl(url))) { noteBlockedNavigation(); return emptyResponse(); }
                return null;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (NavigationPolicy.isAppUrl(url)) { lastAppUrl = url; errorPanel.setVisibility(View.GONE); clearPlaybackContext(); }
                else if (!"about:blank".equals(url)) { view.stopLoading(); noteBlockedNavigation(); view.loadUrl(lastAppUrl); }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!documentStartObserver && NavigationPolicy.isAppUrl(view.getUrl() == null ? "" : view.getUrl())) view.evaluateJavascript(observerScript, null);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { errorPanel.setVisibility(View.VISIBLE); progress.setVisibility(View.GONE); }
            }
        });
        browser.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> noteBlockedNavigation());
        browser.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob) -> updatePipParams());
        if (!(BuildConfig.DEBUG && getIntent().getBooleanExtra(EXTRA_SELF_TEST, false))) {
            if (savedInstanceState == null || browser.restoreState(savedInstanceState) == null) browser.loadUrl(NavigationPolicy.HOME);
        }
    }

    @SuppressLint("SetJavaScriptEnabled") private void configureBrowser() {
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " FlixAndroid/1.0");
        // Async provider flows also receive the same offline popup sink. No new window is displayed.
        settings.setSupportMultipleWindows(true); settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser, true);
        // No general JavaScript/native interface, certificate bypass or external intents.
    }

    private void createErrorPanel() {
        errorPanel = new LinearLayout(this); errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER); errorPanel.setPadding(dp(28), dp(28), dp(28), dp(28));
        errorPanel.setBackgroundColor(Color.rgb(11, 11, 15));
        TextView title = new TextView(this); title.setText("Vamos tentar de novo?"); title.setTextSize(23); title.setTextColor(Color.WHITE);
        TextView description = new TextView(this); description.setText("Confira sua conexão para voltar às suas histórias."); description.setTextColor(Color.LTGRAY); description.setPadding(0, dp(18), 0, dp(24));
        Button retry = new Button(this); retry.setText("Tentar novamente"); retry.setOnClickListener(v -> { errorPanel.setVisibility(View.GONE); browser.loadUrl(lastAppUrl); });
        errorPanel.addView(title); errorPanel.addView(description); errorPanel.addView(retry);
        normal.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1)); errorPanel.setVisibility(View.GONE);
    }

    @SuppressLint("RequiresFeature") private void configureMediaBridge() {
        try (InputStream input = getAssets().open("media-observer.js")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int count;
            while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            observerScript = bytes.toString("UTF-8");
        } catch (Exception ignored) { return; }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        // Only our top-level origin can request PiP or select a watch session.
        WebViewCompat.addWebMessageListener(browser, "FlixControl", Collections.singleton("https://" + NavigationPolicy.APP_HOST), (view, message, sourceOrigin, mainFrame, reply) -> {
            if (!mainFrame || !NavigationPolicy.isAppUrl(sourceOrigin.toString()) || destroyed) return;
            try {
                String raw = message.getData(); if (raw == null || raw.length() > 1024) return;
                JSONObject data = new JSONObject(raw); String type = data.optString("type");
                if ("clear".equals(type)) clearPlaybackContext();
                else if ("pip".equals(type)) enterPlayerPip();
                else if ("context".equals(type)) {
                    String key = data.optString("key"); if (!NavigationPolicy.isPlaybackKey(key)) return;
                    String path = android.net.Uri.parse(browser.getUrl() == null ? "" : browser.getUrl()).getPath();
                    boolean test = BuildConfig.DEBUG && getIntent().getBooleanExtra(EXTRA_SELF_TEST, false);
                    if (!test && !NavigationPolicy.matchesPlaybackPath(key, path)) return;
                    clearPlaybackContext(); contextKey = key;
                    contextSeason = Math.max(0, Math.min(10000, data.optInt("season", 1)));
                    contextEpisode = Math.max(1, Math.min(10000, data.optInt("episode", 1)));
                    double position = data.optDouble("resume", 0);
                    resumePosition = !key.startsWith("live:") && Double.isFinite(position) ? Math.max(0, Math.min(604800, position)) : 0;
                }
            } catch (Exception ignored) { }
        });
        // Frames report bounded media state and, on error 4 only, their assigned media URL.
        // Only the local decoder can use that URL; no URL or cookie is forwarded to the website.
        WebViewCompat.addWebMessageListener(browser, "FlixMedia", Collections.singleton("*"), (view, message, sourceOrigin, mainFrame, reply) -> {
            if (BuildConfig.DEBUG) { mediaMessages++; lastMediaOrigin = sourceOrigin.toString(); }
            if (contextKey.isEmpty() || destroyed || NavigationPolicy.isAdUrl(sourceOrigin.toString())) return;
            if (!NavigationPolicy.isAppUrl(browser.getUrl() == null ? "" : browser.getUrl())) return;
            if (!"https".equals(sourceOrigin.getScheme())) return;
            try {
                String raw = message.getData(); if (raw == null || raw.length() > 8192) return;
                JSONObject data = new JSONObject(raw); String video = data.optString("videoId");
                double duration = data.optDouble("duration", 0), position = data.optDouble("position", 0);
                if (!video.matches("[a-zA-Z0-9_.:-]{1,100}") || !Double.isFinite(duration) || !Double.isFinite(position) || position < 0 || position > 1e12) return;
                if(nativePlayback!=null&&nativePlayback.isOpen())return;
                int error = data.optInt("error", 0);
                if(error==4&&(activeVideo.isEmpty()||activeVideo.equals(video))) {
                    String source=data.optString("source"),sourceType=data.optString("sourceType");
                    if(MediaUrlPolicy.allowed(source)&&sourceType.length()<=100&&recoveredSources.size()<2&&recoveredSources.add(source)) {
                        activeVideo=video;activeReply=reply;
                        try { reply.postMessage(new JSONObject().put("type","pause").put("videoId",video).toString()); } catch(Exception ignored) { }
                        exitFullscreen();
                        try {
                            nativePlayback.open(source,sourceType,sourceOrigin.toString(),browser.getSettings().getUserAgentString(),
                                contextKey.startsWith("live:")?0:Math.max(resumePosition,Math.min(position,604800)),selfTest()?nativeTestSource:null);
                        } catch(RuntimeException failure) {nativePlayback.close(false);notice("Não foi possível preparar este vídeo. Tente o principal ou o legendado.");}
                        return;
                    }
                }
                if (error >= 1 && error <= 4 && (activeVideo.isEmpty() || activeVideo.equals(video))) {
                    playbackActive = false; root.setKeepScreenOn(false); updatePipParams();
                    JSONObject failure = new JSONObject().put("key", contextKey).put("season", contextSeason).put("episode", contextEpisode).put("error", error);
                    browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:progress',{detail:" + failure + "}))", null);
                    return;
                }
                boolean live = contextKey.startsWith("live:") && data.optBoolean("live", false) && duration == 0;
                if (!live && (duration <= 0 || duration > 604800)) return;
                boolean playing = data.optBoolean("playing", false);
                if (playing || activeVideo.isEmpty()) { activeVideo = video; activeReply = reply; }
                if (!video.equals(activeVideo)) return;
                if (resumePosition > 0 && !restoredVideos.contains(video)) {
                    restoredVideos.add(video);
                    JSONObject restore = new JSONObject().put("type", "restore").put("videoId", video).put("position", resumePosition);
                    reply.postMessage(restore.toString());
                    return;
                }
                playbackActive = playing; root.setKeepScreenOn(playing); updatePipParams();
                JSONObject event = new JSONObject().put("key", contextKey).put("season", contextSeason).put("episode", contextEpisode)
                    .put("position", live ? Math.min(position, 604800) : Math.min(position, duration)).put("duration", duration).put("live", live).put("playing", playing).put("ended", data.optBoolean("ended", false));
                browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:progress',{detail:" + event + "}))", null);
            } catch (Exception ignored) { }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(browser, observerScript, Collections.singleton("*")); documentStartObserver = true;
        }
    }

    private void clearPlaybackContext() {
        if(nativePlayback!=null)nativePlayback.close(false);
        recoveredSources.clear();
        contextKey = ""; activeVideo = ""; activeReply = null; resumePosition = 0; playbackActive = false;
        restoredVideos.clear(); root.setKeepScreenOn(false); updatePipParams();
    }
    private boolean canPip() { return getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE); }
    private PictureInPictureParams pipParams() {
        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9));
        Rect rect = new Rect(); View target = nativePlayback!=null&&nativePlayback.isOpen()?root:customView == null ? browser : customView;
        if (target != null && target.getGlobalVisibleRect(rect)) builder.setSourceRectHint(rect);
        if (Build.VERSION.SDK_INT >= 31) builder.setAutoEnterEnabled(playbackActive && (customView != null || (nativePlayback!=null&&nativePlayback.isOpen()))).setSeamlessResizeEnabled(true);
        return builder.build();
    }
    private void updatePipParams() { if (!destroyed && browser != null && canPip()) { try { setPictureInPictureParams(pipParams()); } catch (IllegalStateException ignored) { } } }
    private void notice(String text) { browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:notice',{detail:" + JSONObject.quote(text) + "}))", null); }
    void enterPlayerPip() {
        if (!canPip()) { notice("A janela flutuante não está disponível neste dispositivo."); return; }
        if (!playbackActive) { notice("Inicie o vídeo antes de abrir a janela flutuante."); return; }
        if (isInPictureInPictureMode()) return;
        enteringPip = true;
        if (nativePlayback!=null&&nativePlayback.isOpen()) {nativePlayback.pip(true);enterPipNow();}
        else if (customView != null) enterPipNow();
        else browser.evaluateJavascript("document.body.classList.add('flix-pip');true", result -> enterPipNow());
    }
    private void enterPipNow() {
        if (destroyed || isFinishing()) return;
        try { if (!enterPictureInPictureMode(pipParams())) { enteringPip = false; restoreInlineLayout(); notice("Permita a janela flutuante nas configurações do Android para continuar."); } }
        catch (IllegalStateException | IllegalArgumentException e) { enteringPip = false; restoreInlineLayout(); notice("Permita a janela flutuante nas configurações do Android para continuar."); }
    }
    private void restoreInlineLayout() { if(nativePlayback!=null)nativePlayback.pip(false); if (!destroyed) browser.evaluateJavascript("document.body.classList.remove('flix-pip')", null); }
    @Override protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (playbackActive && !(Build.VERSION.SDK_INT >= 31 && (customView != null || (nativePlayback!=null&&nativePlayback.isOpen())))) enterPlayerPip();
    }
    @Override public void onPictureInPictureModeChanged(boolean inPip, Configuration config) {
        super.onPictureInPictureModeChanged(inPip, config);
        enteringPip = false;
        progress.setVisibility(View.GONE);
        if (inPip) { root.setPadding(0, 0, 0, 0); if(nativePlayback!=null)nativePlayback.pip(true); }
        else { restoreInlineLayout(); root.requestApplyInsets(); }
    }
    @Override protected void onStop() {
        super.onStop();
        if (!enteringPip && !isInPictureInPictureMode() && nativePlayback!=null)nativePlayback.pause();
        if (!enteringPip && !isInPictureInPictureMode() && activeReply != null) {
            try { activeReply.postMessage(new JSONObject().put("type", "pause").put("videoId", activeVideo).toString()); } catch (Exception ignored) { }
        }
    }
    private static WebResourceResponse emptyResponse() { return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("".getBytes(StandardCharsets.UTF_8))); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void noteBlockedNavigation() { blockedNavigations.incrementAndGet(); }
    private void exitFullscreen() {
        if (customView == null) return;
        root.removeView(customView); customView = null; normal.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE); root.requestApplyInsets(); updatePipParams();
        if (customViewCallback != null) { customViewCallback.onCustomViewHidden(); customViewCallback = null; }
    }
    @Override public void onBackPressed() { if(nativePlayback!=null&&nativePlayback.isOpen())nativePlayback.close(true); else if (customView != null) exitFullscreen(); else if (browser.canGoBack()) browser.goBack(); else super.onBackPressed(); }
    @Override protected void onSaveInstanceState(Bundle outState) { browser.saveState(outState); super.onSaveInstanceState(outState); }
    @Override protected void onDestroy() {
        destroyed = true; handler.removeCallbacksAndMessages(null);
        for (WebView sink : popupSinks) sink.destroy(); popupSinks.clear();
        if(nativePlayback!=null)nativePlayback.close(false);
        browser.stopLoading(); browser.destroy(); super.onDestroy();
    }
    void nativeTestClip(byte[] bytes) { if(!selfTest())throw new IllegalStateException("Debug fixture only");nativeTestSource=()->new androidx.media3.datasource.ByteArrayDataSource(bytes); }
    boolean isNativePlaybackOpen() {return nativePlayback!=null&&nativePlayback.isOpen();}
    long nativePositionMs() {return nativePlayback==null?0:nativePlayback.positionMs();}
    WebView testBrowser() { return browser; }
    void loadTestHtml(String html) { if (!selfTest()) throw new IllegalStateException("Test fixture is debug-only"); testHtml = html; browser.loadUrl(NavigationPolicy.HOME + "android-test"); }
    int popupCount() { return blockedPopups.get(); }
    int navigationCount() { return blockedNavigations.get(); }
    boolean isPlaybackActive() { return playbackActive; }
    String mediaDebugState() { return "context=" + contextKey + ", messages=" + mediaMessages + ", origin=" + lastMediaOrigin + ", documentStart=" + documentStartObserver + ", video=" + activeVideo + ", url=" + browser.getUrl(); }
}
