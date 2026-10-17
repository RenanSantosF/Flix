package com.renansantos.flix;

import android.app.Activity;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.datasource.okhttp.OkHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy;
import androidx.media3.exoplayer.upstream.LoadErrorHandlingPolicy;
import androidx.media3.ui.PlayerView;
import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import okhttp3.Cookie;
import okhttp3.CookieJar;
import okhttp3.Dns;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;

/** Automatic format recovery only. No extraction service, HTML proxy, or external app. */
@OptIn(markerClass = UnstableApi.class)
final class NativePlayback {
    interface Listener {
        void progress(double position, double duration, boolean playing, boolean ended);
        void failed(String message);
        void waiting(String message);
        void closed();
    }
    private final Activity activity;
    private final FrameLayout root;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Listener listener;
    private final Runnable pip;
    private ExoPlayer player;
    private LinearLayout panel, toolbar;
    private PlayerView playerView;
    private TextView waitLabel;
    private int session;
    private boolean foreground=true;
    private MediaRateLimit.Limited waitingLimit;
    private final MediaRateLimit rateLimit;
    private final Runnable ticker = new Runnable() {
        @Override public void run() { if (player != null) { report(false);updateWaitingLabel(); handler.postDelayed(this,1000); } }
    };
    NativePlayback(Activity activity, FrameLayout root, Runnable pip, Listener listener) {
        this.activity=activity; this.root=root; this.pip=pip; this.listener=listener;
        rateLimit=new MediaRateLimit(new MediaCooldownStore(activity.getSharedPreferences("media-cooldowns",android.content.Context.MODE_PRIVATE)),System::currentTimeMillis);
    }
    private DataSource.Factory network(MediaRequestContext context, String userAgent) {
        OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(15,TimeUnit.SECONDS).readTimeout(20,TimeUnit.SECONDS)
            .followRedirects(false).followSslRedirects(false)
            .proxy(java.net.Proxy.NO_PROXY)
            .dns(hostname -> {
                List<InetAddress> addresses = Dns.SYSTEM.lookup(hostname);
                for (InetAddress address : addresses) if (!MediaUrlPolicy.publicAddress(address)) throw new UnknownHostException("Non-public media address");
                return addresses;
            })
            .addInterceptor(new MediaRedirectInterceptor())
            .addInterceptor(rateLimit)
            .addNetworkInterceptor(chain -> {
                // This also validates every redirect and every HLS/DASH segment/key request.
                if (!MediaUrlPolicy.allowedNetwork(chain.request().url().toString())) throw new IOException("Invalid media redirect");
                okhttp3.Request.Builder request=chain.request().newBuilder().removeHeader("Referer").removeHeader("Origin");
                for(java.util.Map.Entry<String,String> header:context.headers(chain.request().url().toString()).entrySet())request.header(header.getKey(),header.getValue());
                return chain.proceed(request.build());
            })
            .cookieJar(new CookieJar() {
                @Override public List<Cookie> loadForRequest(HttpUrl url) {
                    if(!context.cookiesAllowed(url.toString()))return Collections.emptyList();
                    String header=CookieManager.getInstance().getCookie(url.toString());
                    if(header==null)return Collections.emptyList();
                    List<Cookie> cookies=new ArrayList<>();
                    for(String pair:header.split(";")){Cookie c=Cookie.parse(url,pair.trim());if(c!=null&&c.matches(url))cookies.add(c);}
                    return cookies;
                }
                @Override public void saveFromResponse(HttpUrl url,List<Cookie> cookies) {
                    if(!context.cookiesAllowed(url.toString()))return;
                    for(Cookie cookie:cookies)CookieManager.getInstance().setCookie(url.toString(),cookie.toString());
                }
            }).build();
        OkHttpDataSource.Factory factory=new OkHttpDataSource.Factory(client).setUserAgent(userAgent);
        return factory; // Keep file/data/content URIs unavailable even inside playlists.
    }
    void browserLimited(String url,java.util.Map<String,String> headers) {
        if(!MediaUrlPolicy.allowedNetwork(url)||headers==null)return;
        String host=android.net.Uri.parse(url).getHost(),retryAfter=null,date=null;
        for(java.util.Map.Entry<String,String> entry:headers.entrySet()) {
            if("Retry-After".equalsIgnoreCase(entry.getKey()))retryAfter=entry.getValue();
            if("Date".equalsIgnoreCase(entry.getKey()))date=entry.getValue();
        }
        if(host!=null)rateLimit.observe(host,retryAfter,date);
    }
    DataSource.Factory sharedRateFixture(byte[] clip,java.util.concurrent.atomic.AtomicInteger calls) {
        okhttp3.OkHttpClient client=new okhttp3.OkHttpClient.Builder().addInterceptor(new MediaRedirectInterceptor()).addInterceptor(rateLimit).addInterceptor(chain->{
            calls.incrementAndGet();return new okhttp3.Response.Builder().request(chain.request()).protocol(okhttp3.Protocol.HTTP_1_1).code(200).message("OK")
                .body(okhttp3.ResponseBody.create(okhttp3.MediaType.parse("video/mp4"),clip)).build();
        }).build();return new OkHttpDataSource.Factory(client);
    }
    void open(String source, String sourceType, MediaRequestContext context, String userAgent, double resume, DataSource.Factory testSource) {
        close(false);
        final int generation=session;
        // Media URLs can contain ephemeral signatures. Do not let engine errors log them.
        androidx.media3.common.util.Log.setLogLevel(androidx.media3.common.util.Log.LOG_LEVEL_OFF);
        if(!MediaUrlPolicy.allowed(source))return;
        panel=new LinearLayout(activity);panel.setOrientation(LinearLayout.VERTICAL);panel.setBackgroundColor(Color.BLACK);
        toolbar=new LinearLayout(activity);toolbar.setGravity(Gravity.CENTER_VERTICAL);toolbar.setPadding(dp(8),0,dp(8),0);
        toolbar.setBackgroundColor(Color.rgb(11,11,15));
        Button back=new Button(activity);back.setText("Voltar");back.setContentDescription("Voltar ao player");back.setOnClickListener(v->close(true));
        TextView title=new TextView(activity);title.setText("FLIX ·");title.setTextColor(Color.WHITE);title.setTextSize(18);title.setGravity(Gravity.CENTER);
        Button floating=new Button(activity);floating.setText("Janela flutuante");floating.setOnClickListener(v->pip.run());
        toolbar.addView(back,new LinearLayout.LayoutParams(-2,-1));toolbar.addView(title,new LinearLayout.LayoutParams(0,-1,1));toolbar.addView(floating,new LinearLayout.LayoutParams(-2,-1));
        panel.addView(toolbar,new LinearLayout.LayoutParams(-1,dp(52)));
        waitLabel=new TextView(activity);waitLabel.setTextColor(Color.LTGRAY);waitLabel.setTextSize(17);waitLabel.setGravity(Gravity.CENTER);
        waitLabel.setPadding(dp(20),dp(24),dp(20),dp(24));waitLabel.setVisibility(View.GONE);panel.addView(waitLabel,new LinearLayout.LayoutParams(-1,-2));
        playerView=new PlayerView(activity);playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        panel.addView(playerView,new LinearLayout.LayoutParams(-1,0,1));root.addView(panel,new FrameLayout.LayoutParams(-1,-1));
        final MediaFormatProbe format=new MediaFormatProbe();
        DataSource.Factory requests=testSource!=null?testSource:network(context,userAgent);
        DefaultMediaSourceFactory sources=new DefaultMediaSourceFactory(observeFormat(requests,source,format));
        final java.util.concurrent.atomic.AtomicBoolean waited=new java.util.concurrent.atomic.AtomicBoolean();
        sources.setLoadErrorHandlingPolicy(new DefaultLoadErrorHandlingPolicy(1) {
            @Override public long getRetryDelayMsFor(LoadErrorHandlingPolicy.LoadErrorInfo info) {
                MediaRateLimit.Limited limited=MediaRateLimit.find(info.exception);
                if(limited==null)return C.TIME_UNSET;
                long delay=Math.max(0,limited.deadline.until-System.currentTimeMillis());
                // One automatic attempt, after the real deadline. Longer waits stay
                // persisted for a later manual attempt, rather than background work.
                if(delay>300000||!waited.compareAndSet(false,true))return C.TIME_UNSET;
                handler.post(()->{if(session==generation)showWaiting(limited);});return delay;
            }
        });
        player=new ExoPlayer.Builder(activity).setMediaSourceFactory(sources)
            .setRenderersFactory(new DefaultRenderersFactory(activity).setEnableDecoderFallback(true)).build();
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(),true);
        playerView.setPlayer(player);
        final ExoPlayer engine=player;
        final double start=resume;
        String type=sourceType.toLowerCase(Locale.ROOT),path=android.net.Uri.parse(source).getPath();
        final String mime=type.contains("mpegurl")||(path!=null&&path.toLowerCase(Locale.ROOT).endsWith(".m3u8"))?MimeTypes.APPLICATION_M3U8:
            type.contains("dash+xml")||(path!=null&&path.toLowerCase(Locale.ROOT).endsWith(".mpd"))?MimeTypes.APPLICATION_MPD:"";
        player.addListener(new Player.Listener() {
            private boolean positioned, formatRecovered;
            @Override public void onIsPlayingChanged(boolean playing) { if(player==engine)report(false); }
            @Override public void onPlaybackStateChanged(int state) {
                if(player!=engine)return;
                if(state==Player.STATE_READY&&waitingLimit!=null){clearWaiting();}
                if(state==Player.STATE_READY&&!positioned){positioned=true;if(start>0&&!player.isCurrentMediaItemLive()&&player.getDuration()>0)player.seekTo(Math.min((long)(start*1000),Math.max(0,player.getDuration()-1000)));}
                if(state==Player.STATE_ENDED)report(true);
            }
            @Override public void onIsLoadingChanged(boolean loading) {
                if(player==engine&&!loading&&waitingLimit!=null&&System.currentTimeMillis()>=waitingLimit.deadline.until)clearWaiting();
            }
            @Override public void onPlayerError(PlaybackException error) {
                if(player!=engine)return;
                String detected=format.manifestMime();
                boolean parsing=error.errorCode==PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED||error.errorCode==PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED;
                // Media3 cannot infer HLS/DASH from a URL such as /stream?id=... .
                // Retry a parsing failure once only when actual bytes identify that
                // manifest. HTTP/authorization/decoder errors are never retried here.
                if(!formatRecovered&&parsing&&!detected.isEmpty()&&!detected.equals(mime)) {
                    formatRecovered=true;positioned=false;
                    player.setMediaItem(new MediaItem.Builder().setUri(source).setMimeType(detected).build());
                    player.prepare();player.play();return;
                }
                String message=failureMessage(error)+" Formato: "+format.description()+" · Media3 "+error.errorCode;
                close(false);listener.failed(message);
            }
        });
        MediaItem.Builder item=new MediaItem.Builder().setUri(source);
        if(!mime.isEmpty())item.setMimeType(mime);
        player.setMediaItem(item.build());player.prepare();player.play();handler.post(ticker);
    }
    private static DataSource.Factory observeFormat(DataSource.Factory factory,String source,MediaFormatProbe probe) {
        return ()->new DataSource() {
            private final DataSource delegate=factory.createDataSource();
            private boolean observed;
            @Override public long open(androidx.media3.datasource.DataSpec spec) throws IOException {
                observed=spec.position==0&&source.equals(spec.uri.toString());
                long result=delegate.open(spec);
                if(observed)for(java.util.Map.Entry<String,java.util.List<String>> entry:delegate.getResponseHeaders().entrySet())
                    if("Content-Type".equalsIgnoreCase(entry.getKey())&&!entry.getValue().isEmpty())probe.response(entry.getValue().get(0));
                return result;
            }
            @Override public int read(byte[] buffer,int offset,int length) throws IOException {
                int n=delegate.read(buffer,offset,length);if(observed&&n>0)probe.read(buffer,offset,n);return n;
            }
            @Override public android.net.Uri getUri() {return delegate.getUri();}
            @Override public java.util.Map<String,java.util.List<String>> getResponseHeaders() {return delegate.getResponseHeaders();}
            @Override public void addTransferListener(androidx.media3.datasource.TransferListener listener) {delegate.addTransferListener(listener);}
            @Override public void close() throws IOException {delegate.close();}
        };
    }
    private void showWaiting(MediaRateLimit.Limited limited) {
        if(player==null||panel==null)return;
        if(!foreground){String message=MediaRateLimit.message(limited,System.currentTimeMillis());close(false);listener.failed(message);return;}
        waitingLimit=limited;playerView.setUseController(false);waitLabel.setVisibility(View.VISIBLE);
        updateWaitingLabel();listener.waiting(MediaRateLimit.message(limited,System.currentTimeMillis()));
    }
    private void updateWaitingLabel() {
        if(waitLabel==null||waitingLimit==null)return;
        long seconds=MediaRateLimit.seconds(waitingLimit.deadline,System.currentTimeMillis());
        waitLabel.setText("Limite temporário do provedor\n"+(seconds>0?"Nova tentativa em "+seconds+" s":"Tentando novamente…"));
    }
    private void clearWaiting() {waitingLimit=null;if(waitLabel!=null)waitLabel.setVisibility(View.GONE);if(playerView!=null)playerView.setUseController(!activity.isInPictureInPictureMode());}
    private static String failureMessage(PlaybackException error) {
        MediaRateLimit.Limited limited=MediaRateLimit.find(error);
        if(limited!=null)return MediaRateLimit.message(limited,System.currentTimeMillis());
        Throwable cause=error;
        for(int i=0;i<12&&cause!=null;i++,cause=cause.getCause())if(cause instanceof HttpDataSource.InvalidResponseCodeException)
            return ((HttpDataSource.InvalidResponseCodeException)cause).responseCode>=300&&((HttpDataSource.InvalidResponseCodeException)cause).responseCode<400
                ?"O servidor retornou um redirecionamento sem destino utilizável (HTTP "+((HttpDataSource.InvalidResponseCodeException)cause).responseCode+")."
                :"O servidor recusou o vídeo (HTTP "+((HttpDataSource.InvalidResponseCodeException)cause).responseCode+"). A fonte precisa ser liberada ou corrigida pelo provedor.";
        cause=error;
        for(int i=0;i<12&&cause!=null;i++,cause=cause.getCause())if(cause instanceof MediaRedirectInterceptor.Failure)
            return "Falha no redirecionamento de vídeo: "+cause.getMessage()+".";
        if(error.errorCode==PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED||error.errorCode==PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED)
            return "O servidor devolveu uma fonte que não pôde ser lida como vídeo. Tente o principal ou o legendado.";
        return "Não foi possível recuperar este vídeo (código "+error.errorCode+"). Tente o principal ou o legendado.";
    }
    void report(boolean ended) { if(player!=null){long duration=player.getDuration();listener.progress(Math.max(0,player.getCurrentPosition()/1000d),duration>0?duration/1000d:0,player.isPlaying(),ended);} }
    void close(boolean reportPosition) {
        session++;
        if(player==null&&panel==null)return;
        handler.removeCallbacks(ticker);
        if(player!=null){if(reportPosition)report(false);ExoPlayer old=player;player=null;playerView.setPlayer(null);old.release();}
        if(panel!=null){root.removeView(panel);panel=null;}toolbar=null;playerView=null;waitLabel=null;waitingLimit=null;listener.closed();
    }
    void visible(){foreground=true;}
    void pause() {
        foreground=false;
        if(waitingLimit!=null) {String message=MediaRateLimit.message(waitingLimit,System.currentTimeMillis());close(false);listener.failed(message);}
        else if(player!=null)player.pause();
    }
    void pip(boolean active) { if(toolbar!=null)toolbar.setVisibility(active?View.GONE:View.VISIBLE);if(playerView!=null)playerView.setUseController(!active&&waitingLimit==null); }
    boolean isWaiting(){return waitingLimit!=null;}
    boolean isOpen() { return player!=null; }
    long positionMs() { return player==null?0:player.getCurrentPosition(); }
    private int dp(int size) { return Math.round(size*activity.getResources().getDisplayMetrics().density); }
}
