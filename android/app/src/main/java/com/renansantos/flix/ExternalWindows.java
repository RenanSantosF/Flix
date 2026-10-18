package com.renansantos.flix;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.os.Message;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.function.BooleanSupplier;
import java.util.function.Function;

/** Visible browser windows for the explicitly selected comparison mode. No bridges. */
final class ExternalWindows {
    private final Activity activity;
    private final BooleanSupplier enabled;
    private final Function<WebResourceRequest,WebResourceResponse> fixture;
    private final ArrayList<Entry> windows=new ArrayList<>();
    private final String userAgent;
    private static final class Entry {
        final WebView view;final Dialog dialog;
        Entry(WebView view,Dialog dialog){this.view=view;this.dialog=dialog;}
    }
    ExternalWindows(Activity activity,String userAgent,BooleanSupplier enabled,Function<WebResourceRequest,WebResourceResponse> fixture){
        this.activity=activity;this.userAgent=userAgent;this.enabled=enabled;this.fixture=fixture;
    }
    @SuppressLint("SetJavaScriptEnabled") boolean open(Message message){
        if(!enabled.getAsBoolean()||activity.isFinishing())return false;
        WebView web=new WebView(activity);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setUserAgentString(userAgent);settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);settings.setBlockNetworkLoads(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
        Dialog dialog=new Dialog(activity,android.R.style.Theme_DeviceDefault_NoActionBar);
        LinearLayout panel=new LinearLayout(activity);panel.setOrientation(LinearLayout.VERTICAL);panel.setBackgroundColor(Color.rgb(17,17,22));
        LinearLayout bar=new LinearLayout(activity);bar.setPadding(12,8,12,8);
        TextView origin=new TextView(activity);origin.setText("Janela externa");origin.setTextColor(Color.WHITE);origin.setMaxLines(2);
        bar.addView(origin,new LinearLayout.LayoutParams(0,-2,1));
        Button close=new Button(activity);close.setText("Fechar janela");close.setOnClickListener(v->dialog.dismiss());bar.addView(close);
        panel.addView(bar);panel.addView(web,new LinearLayout.LayoutParams(-1,0,1));dialog.setContentView(panel);
        Entry entry=new Entry(web,dialog);windows.add(entry);
        dialog.setOnDismissListener(d->{if(windows.remove(entry)){web.stopLoading();web.destroy();}});
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){
                String host=android.net.Uri.parse(url).getHost();origin.setText("Janela externa"+(host==null?"":" · "+host));
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return fixture.apply(request);}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onCreateWindow(WebView view,boolean isDialog,boolean gesture,Message result){return open(result);}
            @Override public void onCloseWindow(WebView view){dialog.dismiss();}
        });
        // Display before handing the window to Chromium: ad pages never load hidden.
        dialog.show();dialog.getWindow().setLayout(-1,-1);
        ((WebView.WebViewTransport)message.obj).setWebView(web);message.sendToTarget();return true;
    }
    void closeAll(){for(Entry entry:new ArrayList<>(windows))entry.dialog.dismiss();}
    int count(){return windows.size();}
    boolean allVisible(){for(Entry entry:windows)if(!entry.dialog.isShowing())return false;return true;}
}
