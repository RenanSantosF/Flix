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
import android.webkit.ConsoleMessage;
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
public final class MainActivity extends androidx.appcompat.app.AppCompatActivity {
    static final String EXTRA_SELF_TEST = "flix.self_test";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayList<WebView> popupSinks = new ArrayList<>();
    private final AtomicInteger blockedPopups = new AtomicInteger();
    private final AtomicInteger blockedNavigations = new AtomicInteger();
    private final HashSet<String> restoredVideos = new HashSet<>();
    private WebView browser;
    private FrameLayout root, normal;
    private LinearLayout errorPanel;
    private View customView;
    private FullscreenPlayerLayout fullscreenPlayer;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private String lastAppUrl = NavigationPolicy.HOME, contextKey = "", activeVideo = "";
    private int contextSeason = 1, contextEpisode = 1;
    private double resumePosition,lastPosition,lastDuration;
    private JavaScriptReplyProxy fullscreenReply;
    private String fullscreenVideo="";
    private boolean playbackActive, documentStartObserver, destroyed, enteringPip, foreground;
    private JavaScriptReplyProxy activeReply;
    private NativePlayback nativePlayback;
    private CastController cast;
    private String castToken="",contextTitle="Flix",nextLabel="";
    private String testCastSource="";
    private final BrowserDiagnostics browserDiagnostics=new BrowserDiagnostics();
    private final BrowserMediaRetry browserRetry=new BrowserMediaRetry();
    private final BrowserRequestGate requestGate=new BrowserRequestGate(System::currentTimeMillis);
    private boolean providerStopped;
    private JavaScriptReplyProxy webRetryReply;
    private String webRetrySource="",webRetryVideo="";
    private Runnable webRetryTask;
    private int contextGeneration,stallGeneration,stallDelayMs=30000;
    private boolean sessionStarted,stallNotice,stallArmed,terminalBrowserError;
    private androidx.media3.datasource.DataSource.Factory nativeTestSource;
    private final HashSet<String> recoveredSources = new HashSet<>();
    private String recoverySource = "";
    private final java.util.HashMap<String,String> recoveryFailures = new java.util.HashMap<>();
    private String observerScript = "";
    private String testHtml, testBootstrap, testManifest, testChildHtml;
    private final AtomicInteger testBrowserPulls=new AtomicInteger(),testBrowserLimits=new AtomicInteger(),testSharedNativePulls=new AtomicInteger();
    private int mediaMessages, testNativeOpens;
    private byte[] testWebClip;
    private boolean testWebAlwaysLimited;
    private final AtomicInteger testWebRequests=new AtomicInteger();
    private volatile long testWebFirstRequestAt,testWebSecondRequestAt;
    private byte[] testMixedClip;
    private final AtomicInteger testMixedHttps=new AtomicInteger(),testMixedHttp=new AtomicInteger(),testMixedScripts=new AtomicInteger();
    private boolean nativeWaitingNotice;
    private Runnable pendingRecovery;
    private String pendingToken="";
    private String lastMediaOrigin = "", recoveryDiagnostic = "";
    private boolean selfTest() { return BuildConfig.DEBUG && getIntent().getBooleanExtra(EXTRA_SELF_TEST, false); }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(11, 11, 15));
        normal = new FrameLayout(this);
        root.addView(normal, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (customView == null && (nativePlayback==null||!nativePlayback.isOpen()) && !isInPictureInPictureMode()) view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            else view.setPadding(0, 0, 0, 0);
            return insets.consumeSystemWindowInsets();
        });
        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(11, 11, 15));
        normal.addView(browser, new FrameLayout.LayoutParams(-1, -1));
        createErrorPanel();
        configureBrowser();
        configureMediaBridge();
        nativePlayback = new NativePlayback(this, root, this::enterPlayerPip, new NativePlayback.Listener() {
            @Override public void progress(double position,double duration,boolean playing,boolean ended) {
                if(contextKey.isEmpty()||destroyed||(cast!=null&&cast.owns()))return;
                playbackActive=playing;if(fullscreenPlayer!=null){fullscreenPlayer.playing(playing);fullscreenPlayer.progress(position,duration);}if(playing){sessionStarted=true;stallArmed=false;stallGeneration++;terminalBrowserError=false;if(stallNotice){stallNotice=false;notice("");diagnostic("");}}root.setKeepScreenOn(playing);updatePipParams();
                if(playing&&nativeWaitingNotice&&nativePlayback!=null&&!nativePlayback.isWaiting()){nativeWaitingNotice=false;notice("");diagnostic("");}
                try {
                    JSONObject event=new JSONObject().put("key",contextKey).put("season",contextSeason).put("episode",contextEpisode)
                        .put("position",position).put("duration",duration).put("playing",playing).put("ended",ended);
                    browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:progress',{detail:"+event+"}))",null);
                } catch(Exception ignored) { }
            }
            @Override public void waiting(String message) {nativeWaitingNotice=true;notice(message);diagnostic(recoveryDiagnostic+" · "+message);}
            @Override public void failed(String message) {
                String failure=recoveryDiagnostic + " · " + message + " · " + browserDiagnostics.summary(recoverySource);
                if(!recoverySource.isEmpty())recoveryFailures.put(recoverySource,failure);
                notice(message);diagnostic(failure);
            }
            @Override public void closed() { nativeSession(false);playbackActive=false;root.setKeepScreenOn(false);updatePipParams(); }
        });
        cast=new CastController(this,new CastController.Listener(){
            public void message(String text){if(!destroyed){notice(text);android.widget.Toast.makeText(MainActivity.this,text,android.widget.Toast.LENGTH_LONG).show();}}
            public void accepted(){if(nativePlayback!=null&&nativePlayback.isOpen())nativePlayback.pauseForCast();else localVideoCommand("pause",0);playbackActive=false;root.setKeepScreenOn(false);}
            public void progress(double position,double duration,boolean playing,boolean ended){if(destroyed||contextKey.isEmpty())return;if(fullscreenPlayer!=null){fullscreenPlayer.playing(playing);fullscreenPlayer.progress(position,duration);}if(nativePlayback!=null)nativePlayback.castPlaying(playing,position,duration);try{JSONObject event=new JSONObject().put("key",contextKey).put("season",contextSeason).put("episode",contextEpisode).put("position",position).put("duration",duration).put("playing",playing).put("ended",ended);browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:progress',{detail:"+event+"}))",null);}catch(Exception ignored){}}
        },selfTest());
        browser.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView view,String url,String message,android.webkit.JsResult result){
                if(CastRequestPolicy.providerUnsupported(url,message)&&!contextKey.isEmpty()&&foreground){result.confirm();openCast();return true;}return super.onJsAlert(view,url,message,result);
            }
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                if(!contextKey.isEmpty())browserDiagnostics.console(message.message(),message.sourceId(),message.lineNumber(),message.messageLevel()==ConsoleMessage.MessageLevel.ERROR);
                return true; // Do not forward provider URLs/tokens from console messages to logcat.
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
                fullscreenPlayer=new FullscreenPlayerLayout(MainActivity.this,view,new FullscreenPlayerLayout.Actions(){
                    public void exit(){exitFullscreen();}
                    public void toggle(){videoCommand("toggle",0);}
                    public void seek(int seconds){videoCommand("seek",seconds);}
                    public void pip(){enterPlayerPip();}
                    public void cast(){openCast();}
                    public void seekTo(double seconds){seekVideoTo(seconds);}
                    public void next(){exitFullscreen();browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:next'))",null);}
                });
                fullscreenPlayer.setNext(nextLabel);
                fullscreenPlayer.playing(playbackActive);fullscreenPlayer.progress(lastPosition,lastDuration);syncFullscreenOwner();
                root.addView(fullscreenPlayer, new FrameLayout.LayoutParams(-1, -1));
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                updatePipParams();
            }
            @Override public void onHideCustomView() { exitFullscreen(); }
        });
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // The update prompt hands the APK download to the system browser; nothing else leaves the app.
                if (request.isForMainFrame() && request.hasGesture() && NavigationPolicy.isDownloadUrl(url)) {
                    try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))); } catch (Exception ignored) { }
                    return true;
                }
                boolean allowed = request.isForMainFrame() ? NavigationPolicy.isAppUrl(url) : NavigationPolicy.canLoadSubframe(url);
                if (!allowed) {noteBlockedNavigation();if(!request.isForMainFrame()&&!contextKey.isEmpty())browserDiagnostics.blockedFrame(request.getUrl().getScheme());}
                return !allowed;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Instrumentation uses a real HTTPS document origin, without weakening media checks.
                if (selfTest() && testHtml != null && request.isForMainFrame() && (NavigationPolicy.HOME + "android-test").equals(url))
                    return new WebResourceResponse("text/html", "UTF-8", new ByteArrayInputStream(testHtml.getBytes(StandardCharsets.UTF_8)));
                if (NavigationPolicy.blockNetworkRequest(url,request.isForMainFrame())) { noteBlockedNavigation(); return emptyResponse(); }
                if(!request.isForMainFrame()&&"GET".equals(request.getMethod())&&!requestGate.await(url,()->handler.post(()->{
                    if(!destroyed&&!contextKey.isEmpty()&&requestGate.ownsRetry(url))diagnostic("Flix "+BuildConfig.VERSION_NAME+" ("+BuildConfig.VERSION_CODE+") · repetição do provedor aguardando Retry-After no WebView · "+browserDiagnostics.summary(""));
                })))return new WebResourceResponse("text/plain","UTF-8",429,"Too Many Requests",Collections.singletonMap("X-Flix-Local-Cooldown","1"),new ByteArrayInputStream(new byte[0]));
                if(selfTest()&&testMixedClip!=null&&"media.flix-fixture.example".equals(request.getUrl().getHost())){
                    if("/movie.mp4".equals(request.getUrl().getPath())){
                        if("https".equals(request.getUrl().getScheme()))testMixedHttps.incrementAndGet();else testMixedHttp.incrementAndGet();
                        return new WebResourceResponse("video/mp4",null,new ByteArrayInputStream(testMixedClip));
                    }
                    if("/active.js".equals(request.getUrl().getPath())){testMixedScripts.incrementAndGet();return new WebResourceResponse("application/javascript","UTF-8",new ByteArrayInputStream("window.insecureScriptRan=true;".getBytes(StandardCharsets.UTF_8)));}
                }
                if(selfTest()&&testBootstrap!=null&&"https://asiafilm.org/flix-player-test.js".equals(url))
                    return new WebResourceResponse("application/javascript","UTF-8",new ByteArrayInputStream(testBootstrap.getBytes(StandardCharsets.UTF_8)));
                if(selfTest()&&testManifest!=null&&(NavigationPolicy.HOME+"test-stream.m3u8").equals(url))
                    return new WebResourceResponse("application/vnd.apple.mpegurl","UTF-8",new ByteArrayInputStream(testManifest.getBytes(StandardCharsets.UTF_8)));
                if(selfTest()&&testChildHtml!=null&&(NavigationPolicy.HOME+"android-test-frame").equals(url))
                    return new WebResourceResponse("text/html","UTF-8",new ByteArrayInputStream(testChildHtml.getBytes(StandardCharsets.UTF_8)));
                if(selfTest()&&testWebClip!=null&&(NavigationPolicy.HOME+"test-web-retry.mp4").equals(url)) {
                    int attempt=testWebRequests.incrementAndGet();long at=android.os.SystemClock.elapsedRealtime();if(attempt==1)testWebFirstRequestAt=at;if(attempt==2)testWebSecondRequestAt=at;
                    if(attempt==1||testWebAlwaysLimited)return new WebResourceResponse("application/json","UTF-8",429,"Too Many Requests",Collections.singletonMap("Retry-After","2"),new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8)));
                    return new WebResourceResponse("video/mp4",null,new ByteArrayInputStream(testWebClip));
                }
                if(selfTest()&&(NavigationPolicy.HOME+"test-browser-pull").equals(url)) {testBrowserPulls.incrementAndGet();return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[]{1}));}
                if(selfTest()&&(NavigationPolicy.HOME+"test-web-limit.mp4").equals(url)) {testBrowserLimits.incrementAndGet();return new WebResourceResponse("video/mp4","UTF-8",429,"Too Many Requests",Collections.singletonMap("Retry-After","8"),new ByteArrayInputStream(new byte[0]));}
                return null;
            }
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response) {
                if(response.getResponseHeaders()!=null)for(java.util.Map.Entry<String,String> header:response.getResponseHeaders().entrySet())if("X-Flix-Local-Cooldown".equalsIgnoreCase(header.getKey())&&"1".equals(header.getValue()))return;
                if(!contextKey.isEmpty())browserDiagnostics.http(request.getUrl().toString(),response.getStatusCode(),requestDestination(request),response.getMimeType());
                if(nativePlayback!=null&&response.getStatusCode()==429&&NavigationPolicy.isAppUrl(browser.getUrl()==null?"":browser.getUrl())) {
                    MediaRateLimit.Deadline deadline=nativePlayback.browserLimited(request.getUrl().toString(),response.getResponseHeaders());
                    if(!contextKey.isEmpty()){
                        String url=request.getUrl().toString();browserRetry.limited(url,deadline);
                        if("GET".equals(request.getMethod())&&requestGate.limited(url,deadline))stopLimitedProvider();else scheduleWebRetry();
                    }
                }
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (NavigationPolicy.isAppUrl(url)) { lastAppUrl = url; errorPanel.setVisibility(View.GONE); clearPlaybackContext(); }
                else if (!"about:blank".equals(url)) { view.stopLoading(); noteBlockedNavigation(); view.loadUrl(lastAppUrl); }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!documentStartObserver && NavigationPolicy.isAppUrl(view.getUrl() == null ? "" : view.getUrl())) view.evaluateJavascript(observerScript, null);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if(!contextKey.isEmpty())browserDiagnostics.network(error.getErrorCode(),request.getUrl().toString(),requestDestination(request),String.valueOf(error.getDescription()));
                if (request.isForMainFrame()) { errorPanel.setVisibility(View.VISIBLE); }
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
        settings.setUserAgentString(settings.getUserAgentString() + " FlixAndroid/1.0 FlixBuild/" + BuildConfig.VERSION_CODE);
        // Async provider flows also receive the same offline popup sink. No new window is displayed.
        settings.setSupportMultipleWindows(true); settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
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
        try (InputStream input = getAssets().open("player-identity.js")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int count;
            while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
            observerScript = bytes.toString("UTF-8") + "\n" + observerScript;
        } catch (Exception ignored) { /* Media reporting remains available without the theme. */ }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        // Only our top-level origin can request PiP or select a watch session.
        WebViewCompat.addWebMessageListener(browser, "FlixControl", Collections.singleton("https://" + NavigationPolicy.APP_HOST), (view, message, sourceOrigin, mainFrame, reply) -> {
            if (!mainFrame || !NavigationPolicy.isAppUrl(sourceOrigin.toString()) || destroyed) return;
            try {
                String raw = message.getData(); if (raw == null || raw.length() > 1024) return;
                JSONObject data = new JSONObject(raw); String type = data.optString("type");
                if ("clear".equals(type)) clearPlaybackContext();
                else if ("native-ready".equals(type)) {
                    if(pendingRecovery!=null&&pendingToken.equals(data.optString("token"))) {Runnable open=pendingRecovery;pendingRecovery=null;pendingToken="";activeReply=null;open.run();}
                }
                else if ("pip".equals(type)) enterPlayerPip();
                else if ("next".equals(type)) { String label=data.optString("label",""); nextLabel=label.substring(0,Math.min(40,label.length())); if(fullscreenPlayer!=null)fullscreenPlayer.setNext(nextLabel); }
                else if ("cast".equals(type)) openCast();
                else if ("context".equals(type)) {
                    String key = data.optString("key"); if (!NavigationPolicy.isPlaybackKey(key)) return;
                    String path = android.net.Uri.parse(browser.getUrl() == null ? "" : browser.getUrl()).getPath();
                    boolean test = BuildConfig.DEBUG && getIntent().getBooleanExtra(EXTRA_SELF_TEST, false);
                    if (!test && !NavigationPolicy.matchesPlaybackPath(key, path)) return;
                    clearPlaybackContext(); contextKey = key;contextTitle=data.optString("title","Flix");contextTitle=contextTitle.substring(0,Math.min(150,contextTitle.length()));
                    contextSeason = Math.max(0, Math.min(10000, data.optInt("season", 1)));
                    contextEpisode = Math.max(1, Math.min(10000, data.optInt("episode", 1)));
                    double position = data.optDouble("resume", 0);
                    resumePosition = !key.startsWith("live:") && Double.isFinite(position) ? Math.max(0, Math.min(604800, position)) : 0;
                    scheduleStallDiagnostic(contextGeneration);
                }
            } catch (Exception ignored) { }
        });
        // Frames report bounded media state and, on error 4 only, their assigned media URL.
        // Only the local decoder can use that URL; no URL or cookie is forwarded to the website.
        WebViewCompat.addWebMessageListener(browser, "FlixMedia", Collections.singleton("*"), (view, message, sourceOrigin, mainFrame, reply) -> {
            if (BuildConfig.DEBUG) { mediaMessages++; lastMediaOrigin = sourceOrigin.toString(); }
            if (contextKey.isEmpty() || destroyed || providerStopped || NavigationPolicy.isAdUrl(sourceOrigin.toString())) return;
            if (!NavigationPolicy.isAppUrl(browser.getUrl() == null ? "" : browser.getUrl())) return;
            if (!"https".equals(sourceOrigin.getScheme())) return;
            try {
                String raw = message.getData(); if (raw == null || raw.length() > 12288) return;
                JSONObject data = new JSONObject(raw); String video = data.optString("videoId");
                double duration = data.optDouble("duration", 0), position = data.optDouble("position", 0);
                if (!video.matches("[a-zA-Z0-9_.:-]{1,100}") || !Double.isFinite(duration) || !Double.isFinite(position) || position < 0 || position > 1e12) return;
                if("cast-source".equals(data.optString("event"))){
                    if(!castToken.isEmpty()&&castToken.equals(data.optString("token"))&&video.equals(activeVideo)){
                        castToken="";
                        String source=data.optString("source");
                        if(selfTest()){testCastSource=source;return;}
                        try{cast.offer(contextKey,new CastMedia(source,data.optString("sourceType"),contextTitle,position,duration,contextKey.startsWith("live:")));}catch(IllegalArgumentException invalid){castMessage("Esta fonte não disponibiliza um endereço compatível com a TV. Tente outro servidor.");}
                    }return;
                }
                if(pendingRecovery!=null||(nativePlayback!=null&&nativePlayback.isOpen()))return;
                if("state".equals(data.optString("event"))) {
                    if(data.optBoolean("adLoading",false))browserDiagnostics.adLoading();
                    browserDiagnostics.source(data.optString("source"),sourceOrigin.toString());
                    requestGate.source(data.optString("source"));
                    if(requestGate.terminal()){stopLimitedProvider();return;}
                    browserDiagnostics.state(data.optString("sourceKind"),data.optInt("readyState",-1),data.optInt("networkState",-1));
                    observeWebRetry(data,reply);
                    terminalBrowserError=false;if(!stallArmed){sessionStarted=false;scheduleStallDiagnostic(contextGeneration);}return;
                }
                int error = data.optInt("error", 0);
                String recoveryReason = "erro de reprodução";
                if(error==4&&foreground&&(activeVideo.isEmpty()||activeVideo.equals(video))) {
                    String source=data.optString("source"),sourceType=data.optString("sourceType");
                    // A rejected HTTP source is not a codec failure. Keep its original
                    // browser session and wait; do not unload it for a second client.
                    if(browserRetry.isLimited(source)) {
                        observeWebRetry(data,reply);
                        if(webRetryTask==null)notice("O provedor limitou esta fonte (HTTP 429). Aguarde antes de recarregar ou selecione outro servidor.");
                        diagnostic(mediaDiagnostic(data,sourceOrigin.getHost(),"HTTP 429 na fonte do WebView")+" · "+browserDiagnostics.summary(source));
                        return;
                    }
                    // The browser may report the same error again after pause/scan.
                    // Never replace the native HTTP/format/decoder failure with a
                    // generic "already attempted" message or issue another request.
                    if(recoveredSources.contains(source)) {
                        String failure=recoveryFailures.get(source);
                        if(failure!=null)diagnostic(failure);
                        return;
                    }
                    recoveryReason = recoveryReason(data, source);
                    if(MediaUrlPolicy.allowed(source)&&sourceType.length()<=100&&recoveredSources.size()<2&&recoveredSources.add(source)) {
                        recoverySource=source;
                        recoveryDiagnostic = mediaDiagnostic(data, sourceOrigin.getHost(), "transferência exclusiva para o motor nativo");
                        diagnostic(recoveryDiagnostic);
                        activeVideo=video;activeReply=reply;
                        cancelWebRetry();exitFullscreen();
                        prepareNativeRecovery(()->{try {
                            if(selfTest())testNativeOpens++;
                            nativePlayback.open(source,sourceType,new MediaRequestContext(data.optString("frameUrl"),sourceOrigin.toString(),data.optString("referrerPolicy"),data.optString("corsMode")),browser.getSettings().getUserAgentString(),
                                contextKey.startsWith("live:")?0:(position>0?Math.min(position,604800):resumePosition),selfTest()?nativeTestSource:null);
                        } catch(RuntimeException failure) {
                            nativePlayback.close(false);notice("Não foi possível preparar este vídeo. Tente o principal ou o legendado.");
                            String description=recoveryDiagnostic + " · falha ao preparar";recoveryFailures.put(source,description);diagnostic(description);
                        }});
                        return;
                    }
                }
                if (error >= 1 && error <= 4 && (activeVideo.isEmpty() || activeVideo.equals(video))) {
                    terminalBrowserError=true;playbackActive = false; root.setKeepScreenOn(false); updatePipParams();
                    diagnostic(mediaDiagnostic(data, sourceOrigin.getHost(), recoveryReason)+" · "+browserDiagnostics.summary(data.optString("source")));
                    JSONObject failure = new JSONObject().put("key", contextKey).put("season", contextSeason).put("episode", contextEpisode).put("error", error);
                    browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:progress',{detail:" + failure + "}))", null);
                    return;
                }
                if(cast!=null&&cast.owns())return;
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
                lastPosition=position;lastDuration=duration;playbackActive = playing;if(fullscreenPlayer!=null){fullscreenPlayer.playing(playing);fullscreenPlayer.progress(position,duration);syncFullscreenOwner();}if(playing&&(position>0.1||"playing".equals(data.optString("event")))){browserRetry.succeeded();if(!sessionStarted||!webRetrySource.isEmpty())notice("");cancelWebRetry();sessionStarted=true;stallArmed=false;stallGeneration++;terminalBrowserError=false;if(stallNotice){stallNotice=false;notice("");diagnostic("");}} root.setKeepScreenOn(playing); updatePipParams();
                JSONObject event = new JSONObject().put("key", contextKey).put("season", contextSeason).put("episode", contextEpisode)
                    .put("position", live ? Math.min(position, 604800) : Math.min(position, duration)).put("duration", duration).put("live", live).put("playing", playing).put("ended", data.optBoolean("ended", false));
                browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:progress',{detail:" + event + "}))", null);
            } catch (Exception ignored) { }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(browser, observerScript, Collections.singleton("*")); documentStartObserver = true;
        }
    }

    private void cancelWebRetry() {
        if(webRetryTask!=null)handler.removeCallbacks(webRetryTask);
        webRetryTask=null;webRetryReply=null;webRetrySource="";webRetryVideo="";
    }
    private void observeWebRetry(JSONObject data,JavaScriptReplyProxy reply) {
        String source=data.optString("source"),video=data.optString("videoId");
        boolean eligible=data.optBoolean("retryWanted",false)&&!data.optBoolean("adLoading",false)
            &&data.optInt("readyState",0)==0&&"https".equals(data.optString("sourceKind"))&&MediaUrlPolicy.allowed(source);
        if(!eligible){cancelWebRetry();return;}
        if(!source.equals(webRetrySource)||!video.equals(webRetryVideo))cancelWebRetry();
        webRetrySource=source;webRetryVideo=video;webRetryReply=reply;scheduleWebRetry();
    }
    private void scheduleWebRetry() {
        if(webRetryTask!=null||webRetryReply==null||destroyed||!foreground||contextKey.isEmpty()||pendingRecovery!=null||nativePlayback.isOpen())return;
        long wait=browserRetry.waitMillis(webRetrySource,System.currentTimeMillis());if(wait<0)return;
        final int generation=contextGeneration;final String source=webRetrySource,video=webRetryVideo;final JavaScriptReplyProxy reply=webRetryReply;
        notice("O provedor limitou esta fonte (HTTP 429). Nova tentativa no player em "+Math.max(1,(wait+999)/1000)+" s.");
        webRetryTask=()->{
            webRetryTask=null;
            if(destroyed||!foreground||generation!=contextGeneration||!source.equals(webRetrySource)||!video.equals(webRetryVideo)||pendingRecovery!=null||nativePlayback.isOpen())return;
            long remaining=browserRetry.waitMillis(source,System.currentTimeMillis());
            if(remaining>0){scheduleWebRetry();return;}
            if(!browserRetry.consume(source,System.currentTimeMillis()))return;
            if(requestGate.ownsRetry(source)){
                notice("A fonte está sendo retomada pelo próprio player após a espera do HTTP 429.");return;
            }
            requestGate.appRetry(source);
            try {
                browserDiagnostics.retry(source);
                reply.postMessage(new JSONObject().put("type","retry-source").put("videoId",video).put("source",source).toString());
                notice("Tentando novamente no player. Se o provedor continuar recusando, selecione outro servidor.");
                diagnostic("Flix "+BuildConfig.VERSION_NAME+" ("+BuildConfig.VERSION_CODE+") · uma retomada no WebView após HTTP 429 · "+browserDiagnostics.summary(""));
                stallNotice=false;stallArmed=false;scheduleStallDiagnostic(contextGeneration);
            }catch(Exception ignored) {notice("A sessão do player mudou. Recarregue para voltar aos servidores.");}
        };
        handler.postDelayed(webRetryTask,Math.max(1,wait));
    }

    private void stopLimitedProvider() {
        if(providerStopped||destroyed||contextKey.isEmpty())return;
        providerStopped=true;terminalBrowserError=true;cancelWebRetry();requestGate.source("");
        playbackActive=false;root.setKeepScreenOn(false);
        notice("O provedor mantém esta fonte limitada (HTTP 429). As repetições foram interrompidas. Selecione outro servidor ou tente mais tarde.");
        diagnostic("Flix "+BuildConfig.VERSION_NAME+" ("+BuildConfig.VERSION_CODE+") · HTTP 429 persistente ou espera longa · repetições do provedor interrompidas · "+browserDiagnostics.summary(""));
        try{JSONObject detail=new JSONObject().put("key",contextKey).put("season",contextSeason).put("episode",contextEpisode);
            browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:provider-limited',{detail:"+detail+"}))",null);
        }catch(Exception ignored){}
    }
    private void nativeSession(boolean active) {
        if(destroyed||contextKey.isEmpty())return;
        try {JSONObject detail=new JSONObject().put("key",contextKey).put("season",contextSeason).put("episode",contextEpisode).put("active",active);
            browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:native-session',{detail:"+detail+"}))",null);
        }catch(Exception ignored){}
    }
    private void prepareNativeRecovery(Runnable open) {
        String token=java.util.UUID.randomUUID().toString();pendingRecovery=open;pendingToken=token;
        nativeSession(true);
        // The provider document is unloaded before the native engine can connect.
        // Keeping the same iframe node also keeps React's ownership of the DOM.
        String script="(function(){var f=document.querySelector('#player-frame iframe'),token="+JSONObject.quote(token)+";"
            +"function ready(){window.FlixControl.postMessage(JSON.stringify({type:'native-ready',token:token}));}"
            +"if(!f){"+(selfTest()?"ready();":"")+"return;}"
            +"function done(){try{if(f.contentWindow.location.href!=='about:blank')return;}catch(e){return;}f.removeEventListener('load',done);ready();}"
            +"f.addEventListener('load',done);f.removeAttribute('srcdoc');f.src='about:blank';})();";
        browser.evaluateJavascript(script,null);
        handler.postDelayed(()->{if(pendingRecovery!=null&&pendingToken.equals(token)) {
            pendingRecovery=null;pendingToken="";nativeSession(false);
            String message="Não foi possível concluir a transferência do vídeo. Recarregue para voltar aos servidores.";
            recoveryFailures.put(recoverySource,recoveryDiagnostic+" · transferência não confirmada");notice(message);diagnostic(recoveryFailures.get(recoverySource));
        }},3000);
    }
    private static String requestDestination(WebResourceRequest request){
        for(java.util.Map.Entry<String,String> e:request.getRequestHeaders().entrySet())if("Sec-Fetch-Dest".equalsIgnoreCase(e.getKey()))return e.getValue();
        return request.isForMainFrame()?"document":"";
    }
    private void scheduleStallDiagnostic(int generation) {
        stallArmed=true;int attempt=++stallGeneration;
        handler.postDelayed(()->{
            if(destroyed||!foreground||webRetryTask!=null||contextGeneration!=generation||stallGeneration!=attempt||terminalBrowserError||contextKey.isEmpty()||sessionStarted||stallNotice||pendingRecovery!=null||nativePlayback.isOpen()||!recoveryFailures.isEmpty())return;
            android.content.pm.PackageInfo engine=WebView.getCurrentWebViewPackage();
            String text="Flix "+BuildConfig.VERSION_NAME+" ("+BuildConfig.VERSION_CODE+") · WebView "+(engine==null?"?":engine.versionName)
                +" · sem reprodução após 30 s · "+browserDiagnostics.summary("");
            stallNotice=true;notice("O player ainda não iniciou o vídeo. Copie os detalhes da reprodução abaixo para verificar a causa.");diagnostic(text);
        },stallDelayMs);
    }
    private void clearPlaybackContext() {
        restoreProviderControls();lastPosition=0;lastDuration=0;castToken="";if(cast!=null)cast.clear();cancelWebRetry();browserRetry.clear();requestGate.clear();providerStopped=false;contextGeneration++;stallGeneration++;terminalBrowserError=false;sessionStarted=false;stallNotice=false;stallArmed=false;browserDiagnostics.clear();
        pendingRecovery=null;pendingToken="";
        if(nativePlayback!=null)nativePlayback.close(false);
        recoveredSources.clear(); recoveryFailures.clear(); nativeWaitingNotice=false; recoverySource=""; recoveryDiagnostic = ""; diagnostic("");
        contextKey = ""; activeVideo = ""; activeReply = null; resumePosition = 0; playbackActive = false;
        restoredVideos.clear(); root.setKeepScreenOn(false); updatePipParams();
    }
    private String recoveryReason(JSONObject data, String source) {
        if (!source.isEmpty()) {
            if (!MediaUrlPolicy.allowed(source)) return "endereço da fonte não aceito";
            if (recoveredSources.contains(source)) return "esta fonte já foi tentada";
            if (recoveredSources.size() >= 2) return "limite de recuperação atingido";
            return "tipo de fonte inválido";
        }
        switch(data.optString("sourceReason")) {
            case "ambiguous-manifest": return "mais de um vídeo ou manifesto; fonte indefinida";
            case "blob-without-manifest": return "blob sem manifesto HTTPS identificável";
            case "source-too-long": return "endereço da fonte excedeu o limite";
            default: return "player não forneceu uma fonte HTTPS";
        }
    }
    private String mediaDiagnostic(JSONObject data, String host, String reason) {
        String kind = data.optString("sourceKind");
        if (!kind.matches("https|http|blob|missing|other")) kind = "missing";
        String frame = host != null && host.matches("[a-zA-Z0-9.-]{1,253}") ? host : "frame";
        android.content.pm.PackageInfo engine = WebView.getCurrentWebViewPackage();
        String version = engine == null ? "?" : engine.versionName;
        String mediaHost="";
        try {String value=java.net.URI.create(data.optString("source")).getHost();if(MediaUrlPolicy.allowed(data.optString("source"))&&value!=null&&value.matches("[a-zA-Z0-9.-]{1,253}"))mediaHost=" · mídia "+value;}catch(RuntimeException ignored) { }
        // Only versions, source scheme, frame/media hostname and fixed reasons. Never paths,
        // query strings, cookies, provider HTML or signed media addresses.
        return "Flix " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ") · WebView " + version
            + " · " + frame + " · fonte " + kind + mediaHost + " · " + reason;
    }
    private void diagnostic(String text) {
        if (browser != null && !destroyed) browser.evaluateJavascript("window.dispatchEvent(new CustomEvent('flix:diagnostic',{detail:" + JSONObject.quote(text) + "}))", null);
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
    private void restoreInlineLayout() { if(fullscreenPlayer!=null)fullscreenPlayer.pip(false);if(nativePlayback!=null)nativePlayback.pip(false); if (!destroyed) browser.evaluateJavascript("document.body.classList.remove('flix-pip')", null); }
    @Override protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (playbackActive && !(Build.VERSION.SDK_INT >= 31 && (customView != null || (nativePlayback!=null&&nativePlayback.isOpen())))) enterPlayerPip();
    }
    @Override public void onPictureInPictureModeChanged(boolean inPip, Configuration config) {
        super.onPictureInPictureModeChanged(inPip, config);
        enteringPip = false;
        if (inPip) { if(fullscreenPlayer!=null)fullscreenPlayer.pip(true);root.setPadding(0, 0, 0, 0); if(nativePlayback!=null)nativePlayback.pip(true); }
        else { restoreInlineLayout(); root.requestApplyInsets(); }
    }
    @Override protected void onStart() {super.onStart();foreground=true;requestGate.visible(true);if(nativePlayback!=null)nativePlayback.visible();}
    @Override protected void onStop() {
        super.onStop();foreground=false;requestGate.visible(enteringPip||isInPictureInPictureMode());
        if(webRetryReply!=null)try{webRetryReply.postMessage(new JSONObject().put("type","pause").put("videoId",webRetryVideo).toString());}catch(Exception ignored){}
        cancelWebRetry();
        if (!enteringPip && !isInPictureInPictureMode()) {if(pendingRecovery!=null)nativeSession(false);pendingRecovery=null;pendingToken="";if(nativePlayback!=null)nativePlayback.pause();}
        if (!enteringPip && !isInPictureInPictureMode() && activeReply != null) {
            try { activeReply.postMessage(new JSONObject().put("type", "pause").put("videoId", activeVideo).toString()); } catch (Exception ignored) { }
        }
    }
    private static WebResourceResponse emptyResponse() { return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("".getBytes(StandardCharsets.UTF_8))); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void noteBlockedNavigation() { blockedNavigations.incrementAndGet(); }
    private void castMessage(String text){notice(text);android.widget.Toast.makeText(this,text,android.widget.Toast.LENGTH_LONG).show();}
    void openCast(){
        if(destroyed||!foreground||contextKey.isEmpty())return;
        if(nativePlayback!=null&&nativePlayback.isOpen()){
            try{cast.offer(contextKey,new CastMedia(recoverySource,nativePlayback.mediaType(),contextTitle,nativePlayback.positionMs()/1000d,nativePlayback.durationMs()/1000d,contextKey.startsWith("live:")));}catch(IllegalArgumentException invalid){castMessage("Esta fonte não está disponível para transmitir à TV.");}return;
        }
        if(activeReply==null||activeVideo.isEmpty()){castMessage("Inicie o vídeo e depois toque em Transmitir para TV.");return;}
        castToken=java.util.UUID.randomUUID().toString();String token=castToken;
        try{activeReply.postMessage(new JSONObject().put("type","cast-source").put("videoId",activeVideo).put("token",token).toString());}catch(Exception failed){castToken="";castMessage("Não foi possível preparar a transmissão. Tente novamente.");return;}
        handler.postDelayed(()->{if(token.equals(castToken)){castToken="";castMessage("O player não respondeu. Retome o vídeo e tente transmitir novamente.");}},5000);
    }
    private void seekVideoTo(double position){
        if(cast!=null&&cast.seekTo(position))return;
        if(activeReply!=null&&!activeVideo.isEmpty())try{activeReply.postMessage(new JSONObject().put("type","seek-to").put("videoId",activeVideo).put("position",position).toString());}catch(Exception ignored){}
    }
    boolean castSeekTo(double position){return cast!=null&&cast.seekTo(position);}
    boolean isCasting(){return cast!=null&&cast.owns();}
    boolean castControl(String type,int seconds){return cast!=null&&cast.control(type,seconds);}
    private void videoCommand(String type,int seconds){
        if(cast!=null&&cast.control(type,seconds))return;localVideoCommand(type,seconds);
    }
    private void localVideoCommand(String type,int seconds){
        if(activeReply!=null&&!activeVideo.isEmpty())try{activeReply.postMessage(new JSONObject().put("type",type).put("videoId",activeVideo).put("seconds",seconds).toString());}catch(Exception ignored){}
    }
    private void syncFullscreenOwner(){
        if(fullscreenPlayer==null||activeReply==null||activeVideo.isEmpty()||fullscreenVideo.equals(activeVideo))return;
        restoreProviderControls();fullscreenReply=activeReply;fullscreenVideo=activeVideo;
        try{fullscreenReply.postMessage(new JSONObject().put("type","fullscreen-ui").put("videoId",fullscreenVideo).put("active",true).toString());}catch(Exception ignored){}
    }
    private void restoreProviderControls(){
        if(fullscreenReply!=null)try{fullscreenReply.postMessage(new JSONObject().put("type","fullscreen-ui").put("videoId",fullscreenVideo).put("active",false).toString());}catch(Exception ignored){}
        fullscreenReply=null;fullscreenVideo="";
    }
    private void exitFullscreen() {
        if (customView == null) return;
        restoreProviderControls();
        if(fullscreenPlayer!=null){fullscreenPlayer.release();root.removeView(fullscreenPlayer);fullscreenPlayer=null;}customView = null; normal.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE); root.requestApplyInsets(); updatePipParams();
        if (customViewCallback != null) { customViewCallback.onCustomViewHidden(); customViewCallback = null; }
    }
    @Override public void onBackPressed() { if(nativePlayback!=null&&nativePlayback.isOpen())nativePlayback.close(true); else if (customView != null) exitFullscreen(); else if (browser.canGoBack()) browser.goBack(); else super.onBackPressed(); }
    @Override protected void onSaveInstanceState(Bundle outState) { browser.saveState(outState); super.onSaveInstanceState(outState); }
    @Override protected void onDestroy() {
        destroyed = true;requestGate.clear();cancelWebRetry();pendingRecovery=null;pendingToken=""; handler.removeCallbacksAndMessages(null);
        for (WebView sink : popupSinks) sink.destroy(); popupSinks.clear();
        if(cast!=null)cast.destroy();exitFullscreen();if(nativePlayback!=null)nativePlayback.close(false);
        browser.stopLoading(); browser.destroy(); super.onDestroy();
    }
    void playerTestBootstrap(String script) {if(!selfTest())throw new IllegalStateException("Debug fixture only");testBootstrap=script;}
    void nativeTestClip(byte[] bytes) { if(!selfTest())throw new IllegalStateException("Debug fixture only");nativeTestSource=()->new androidx.media3.datasource.ByteArrayDataSource(bytes); }
    void nativeTestHls(byte[] segment) {
        if(!selfTest())throw new IllegalStateException("Debug fixture only");
        testManifest="#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:12\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:12,\n"+NavigationPolicy.HOME+"test-segment.ts\n#EXT-X-ENDLIST\n";
        nativeTestSource=()->new androidx.media3.datasource.DataSource() {
            private androidx.media3.datasource.ByteArrayDataSource delegate;
            @Override public long open(androidx.media3.datasource.DataSpec spec) throws java.io.IOException {
                byte[] bytes=(spec.uri.getPath().endsWith(".m3u8")||spec.uri.getPath().endsWith("/test-stream"))?testManifest.getBytes(StandardCharsets.UTF_8):segment;
                delegate=new androidx.media3.datasource.ByteArrayDataSource(bytes);return delegate.open(spec);
            }
            @Override public int read(byte[] buffer,int offset,int length) throws java.io.IOException {return delegate.read(buffer,offset,length);}
            @Override public android.net.Uri getUri() {return delegate==null?null:delegate.getUri();}
            @Override public void addTransferListener(androidx.media3.datasource.TransferListener listener) { }
            @Override public void close() throws java.io.IOException {if(delegate!=null)delegate.close();}
        };
    }
    private final java.util.concurrent.atomic.AtomicInteger testRedirects=new java.util.concurrent.atomic.AtomicInteger();
    void nativeTestRedirectClip(byte[] clip) {
        if(!selfTest())throw new IllegalStateException("Debug fixture only");
        okhttp3.OkHttpClient client=new okhttp3.OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
            .addInterceptor(new MediaRedirectInterceptor()).addInterceptor(chain->{
                okhttp3.Response.Builder response=new okhttp3.Response.Builder().request(chain.request()).protocol(okhttp3.Protocol.HTTP_1_1);
                if(chain.request().url().isHttps()) {
                    testRedirects.incrementAndGet();return response.code(302).message("Found").header("Location","http://cdn.provider.example/video.mp4")
                        .body(okhttp3.ResponseBody.create(okhttp3.MediaType.parse("text/plain"),new byte[0])).build();
                }
                return response.code(200).message("OK").body(okhttp3.ResponseBody.create(okhttp3.MediaType.parse("video/mp4"),clip)).build();
            }).build();
        nativeTestSource=new androidx.media3.datasource.okhttp.OkHttpDataSource.Factory(client);
    }
    int nativeTestRedirectCount(){return testRedirects.get();}
    private final java.util.concurrent.atomic.AtomicInteger testLimitedRequests=new java.util.concurrent.atomic.AtomicInteger();
    void nativeTestRateLimitClip(byte[] clip,int seconds,boolean alwaysLimited) {
        if(!selfTest())throw new IllegalStateException("Debug fixture only");
        MediaRateLimit limiter=new MediaRateLimit(new MediaRateLimit.MemoryStore(),System::currentTimeMillis);
        okhttp3.OkHttpClient client=new okhttp3.OkHttpClient.Builder().followRedirects(false)
            .addInterceptor(new MediaRedirectInterceptor()).addInterceptor(limiter).addInterceptor(chain->{
                int call=testLimitedRequests.incrementAndGet();okhttp3.Response.Builder response=new okhttp3.Response.Builder().request(chain.request()).protocol(okhttp3.Protocol.HTTP_1_1);
                if(call==1||alwaysLimited)return response.code(429).message("Too Many Requests").header("Retry-After",String.valueOf(seconds))
                    .body(okhttp3.ResponseBody.create(okhttp3.MediaType.parse("text/plain"),new byte[0])).build();
                return response.code(200).message("OK").body(okhttp3.ResponseBody.create(okhttp3.MediaType.parse("video/mp4"),clip)).build();
            }).build();nativeTestSource=new androidx.media3.datasource.okhttp.OkHttpDataSource.Factory(client);
    }
    int nativeTestLimitedCount(){return testLimitedRequests.get();}
    void testChildHtml(String html){if(!selfTest())throw new IllegalStateException("Debug fixture only");testChildHtml=html;}
    void nativeSharedRateClip(byte[] clip){if(!selfTest())throw new IllegalStateException("Debug fixture only");nativeTestSource=nativePlayback.sharedRateFixture(clip,testSharedNativePulls);}
    int browserPullCount(){return testBrowserPulls.get();}int browserLimitCount(){return testBrowserLimits.get();}int sharedNativePullCount(){return testSharedNativePulls.get();}
    void testWebRetryClip(byte[] clip,boolean alwaysLimited){if(!selfTest())throw new IllegalStateException("Debug fixture only");testWebClip=clip;testWebAlwaysLimited=alwaysLimited;}
    void testMixedClip(byte[] clip){if(!selfTest())throw new IllegalStateException("Debug fixture only");testMixedClip=clip;}
    int testMixedHttpsCount(){return testMixedHttps.get();}int testMixedHttpCount(){return testMixedHttp.get();}int testMixedScriptCount(){return testMixedScripts.get();}
    int testWebRetryCount(){return testWebRequests.get();}
    int testHeldRequests(){return requestGate.held();}
    long testWebRetryInterval(){return testWebSecondRequestAt-testWebFirstRequestAt;}
    void testStallDelay(int millis){if(!selfTest())throw new IllegalStateException("Debug fixture only");stallDelayMs=millis;}
    int nativeOpenCount(){return testNativeOpens;}
    boolean isNativePlaybackOpen() {return nativePlayback!=null&&nativePlayback.isOpen();}
    long nativePositionMs() {return nativePlayback==null?0:nativePlayback.positionMs();}
    String testCastSource(){return testCastSource;}
    FullscreenPlayerLayout fullscreenControls(){return fullscreenPlayer;}
    WebView testBrowser() { return browser; }
    void loadTestHtml(String html) { if (!selfTest()) throw new IllegalStateException("Test fixture is debug-only"); testHtml = html; browser.loadUrl(NavigationPolicy.HOME + "android-test"); }
    int popupCount() { return blockedPopups.get(); }
    int navigationCount() { return blockedNavigations.get(); }
    boolean isPlaybackActive() { return playbackActive; }
    String mediaDebugState() { return "context=" + contextKey + ", messages=" + mediaMessages + ", origin=" + lastMediaOrigin + ", documentStart=" + documentStartObserver + ", video=" + activeVideo + ", url=" + browser.getUrl(); }
}
