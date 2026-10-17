package com.renansantos.flix;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
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
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicInteger;

public final class MainActivity extends Activity {
    static final String EXTRA_SELF_TEST = "flix.self_test";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayList<WebView> popupSinks = new ArrayList<>();
    private final AtomicInteger blockedPopups = new AtomicInteger();
    private final AtomicInteger blockedNavigations = new AtomicInteger();
    private WebView browser;
    private TextView status;
    private FrameLayout root;
    private LinearLayout normal;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private String lastAppUrl = NavigationPolicy.HOME;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 11, 18));
        normal = new LinearLayout(this);
        normal.setOrientation(LinearLayout.VERTICAL);
        root.addView(normal, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (customView == null) view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(14), dp(6), dp(8), dp(6));
        TextView brand = new TextView(this);
        brand.setText("FLIX"); brand.setTextSize(23); brand.setTextColor(Color.rgb(239, 0, 62));
        brand.setTypeface(null, Typeface.BOLD);
        toolbar.addView(brand, new LinearLayout.LayoutParams(0, dp(48), 1));
        Button home = new Button(this); home.setText("Início"); home.setOnClickListener(v -> browser.loadUrl(NavigationPolicy.HOME));
        toolbar.addView(home);
        Button reload = new Button(this); reload.setText("Atualizar"); reload.setOnClickListener(v -> browser.reload());
        toolbar.addView(reload);
        normal.addView(toolbar);
        status = new TextView(this);
        status.setTextColor(Color.rgb(180, 190, 205)); status.setTextSize(12);
        status.setPadding(dp(14), 0, dp(14), dp(8));
        normal.addView(status); updateStatus();
        ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100); normal.addView(progress, new LinearLayout.LayoutParams(-1, dp(2)));
        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(8, 11, 18));
        normal.addView(browser, new LinearLayout.LayoutParams(-1, 0, 1));
        configureBrowser();
        browser.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value); progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE);
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, Message resultMsg) {
                // Consume the popup in a never-displayed, network-disabled WebView.
                // The visible player keeps working; no external tab or intent is launched.
                blockedPopups.incrementAndGet(); updateStatus();
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
                if (NavigationPolicy.isAdUrl(url) || (request.isForMainFrame() && !NavigationPolicy.isAppUrl(url))) {
                    noteBlockedNavigation(); return emptyResponse();
                }
                return null;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (NavigationPolicy.isAppUrl(url)) lastAppUrl = url;
                else if (!"about:blank".equals(url)) { view.stopLoading(); noteBlockedNavigation(); view.loadUrl(lastAppUrl); }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) status.setText("Falha ao carregar. Confira a internet e toque em Atualizar.");
            }
        });
        browser.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> noteBlockedNavigation());
        if (!(BuildConfig.DEBUG && getIntent().getBooleanExtra(EXTRA_SELF_TEST, false))) {
            if (savedInstanceState == null || browser.restoreState(savedInstanceState) == null) browser.loadUrl(NavigationPolicy.HOME);
        }
    }

    @SuppressLint("SetJavaScriptEnabled") private void configureBrowser() {
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " FlixAndroid/1.0");
        settings.setSupportMultipleWindows(true); settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser, true);
        // No JavaScript interface, certificate bypass or external intent handling.
    }

    private static WebResourceResponse emptyResponse() {
        return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("".getBytes(StandardCharsets.UTF_8)));
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void noteBlockedNavigation() { blockedNavigations.incrementAndGet(); handler.post(this::updateStatus); }
    private void updateStatus() { status.setText("Proteção ativa • " + (blockedPopups.get() + blockedNavigations.get()) + " bloqueios"); }
    private void exitFullscreen() {
        if (customView == null) return;
        root.removeView(customView); customView = null; normal.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        root.requestApplyInsets();
        if (customViewCallback != null) { customViewCallback.onCustomViewHidden(); customViewCallback = null; }
    }
    @Override public void onBackPressed() { if (customView != null) exitFullscreen(); else if (browser.canGoBack()) browser.goBack(); else super.onBackPressed(); }
    @Override protected void onSaveInstanceState(Bundle outState) { browser.saveState(outState); super.onSaveInstanceState(outState); }
    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        for (WebView sink : popupSinks) sink.destroy(); popupSinks.clear();
        browser.stopLoading(); browser.destroy(); super.onDestroy();
    }
    WebView testBrowser() { return browser; }
    int popupCount() { return blockedPopups.get(); }
    int navigationCount() { return blockedNavigations.get(); }
}
