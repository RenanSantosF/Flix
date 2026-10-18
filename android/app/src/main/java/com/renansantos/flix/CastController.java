package com.renansantos.flix;

import android.os.Handler;
import android.os.Looper;
import androidx.fragment.app.FragmentActivity;
import androidx.mediarouter.app.MediaRouteChooserDialogFragment;
import androidx.mediarouter.app.MediaRouteControllerDialogFragment;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.MediaSeekOptions;
import com.google.android.gms.cast.MediaStatus;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManagerListener;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Google Cast Sender. A receiver confirms playback before local playback is paused. */
final class CastController implements SessionManagerListener<CastSession> {
    interface Listener {void message(String message);void accepted();void progress(double position,double duration,boolean playing,boolean ended);}
    private final FragmentActivity activity;private final Listener listener;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private CastContext context;private CastMedia media;private String key="",sent="";private boolean requested,dead,owned,accepted,failedInit;
    private RemoteMediaClient registered;
    private final RemoteMediaClient.Callback callback=new RemoteMediaClient.Callback(){@Override public void onStatusUpdated(){update();}@Override public void onMediaError(com.google.android.gms.cast.MediaError error){if(owned){owned=false;listener.message("A TV não conseguiu abrir esta fonte. Tente outro servidor no player.");}}};
    private final Runnable ticker=new Runnable(){public void run(){if(dead)return;update();handler.postDelayed(this,1000);}};
    CastController(FragmentActivity activity,Listener listener,boolean fixture){this.activity=activity;this.listener=listener;
        if(fixture)return;
        try{CastContext.getSharedInstance(activity,executor).addOnSuccessListener(value->{if(dead)return;context=value;value.getSessionManager().addSessionManagerListener(this,CastSession.class);handler.post(ticker);if(requested)showDialog();}).addOnFailureListener(error->{failedInit=true;if(requested)unavailable();});}catch(RuntimeException error){failedInit=true;}
    }
    void offer(String key,CastMedia candidate){if(dead)return;boolean same=this.key.equals(key)&&candidate.url.equals(sent)&&owns();this.key=key;this.media=candidate;requested=true;if(!same){sent="";accepted=false;}if(context!=null)showDialog();else if(failedInit)unavailable();else listener.message("Preparando a conexão com a TV…");}
    private void unavailable(){requested=false;listener.message("Google Cast indisponível. Confira se o Google Play Services está atualizado neste celular.");}
    private void showDialog(){
        if(dead||activity.isFinishing()||activity.getSupportFragmentManager().isStateSaved())return;
        requested=false;CastSession session=context.getSessionManager().getCurrentCastSession();
        if(session!=null&&session.isConnected()){
            if(media!=null&&(!owns()||!media.url.equals(sent)))load(session);
            if(activity.getSupportFragmentManager().findFragmentByTag("flix-cast")!=null)return;
            MediaRouteControllerDialogFragment dialog=new MediaRouteControllerDialogFragment();dialog.show(activity.getSupportFragmentManager(),"flix-cast");
        }else if(activity.getSupportFragmentManager().findFragmentByTag("flix-cast")==null){MediaRouteChooserDialogFragment dialog=new MediaRouteChooserDialogFragment();dialog.setRouteSelector(context.getMergedSelector());dialog.show(activity.getSupportFragmentManager(),"flix-cast");}
    }
    private void load(CastSession session){
        RemoteMediaClient client=session.getRemoteMediaClient();if(client==null||media==null)return;
        CastMedia candidate=media;String contextKey=key;
        if(registered!=client){if(registered!=null)registered.unregisterCallback(callback);registered=client;client.registerCallback(callback);}
        MediaMetadata metadata=new MediaMetadata(MediaMetadata.MEDIA_TYPE_MOVIE);metadata.putString(MediaMetadata.KEY_TITLE,candidate.title);
        MediaInfo.Builder info=new MediaInfo.Builder(candidate.url).setContentType(candidate.mime).setStreamType(candidate.live?MediaInfo.STREAM_TYPE_LIVE:MediaInfo.STREAM_TYPE_BUFFERED).setMetadata(metadata);
        if(candidate.duration>0)info.setStreamDuration(candidate.duration);
        sent=candidate.url;owned=true;accepted=false;
        client.load(new MediaLoadRequestData.Builder().setMediaInfo(info.build()).setCurrentTime(candidate.position).setAutoplay(true).build()).setResultCallback(result->{
            if(dead||media!=candidate||!key.equals(contextKey))return;
            if(!result.getStatus().isSuccess()){owned=false;listener.message("A TV recusou esta fonte (código "+result.getStatus().getStatusCode()+"). Tente outro servidor; a reprodução no celular continua disponível.");}else update();
        });
    }
    private void update(){
        if(!owns())return;RemoteMediaClient client=client();MediaStatus status=client.getMediaStatus();
        if(client.getMediaInfo()==null||!sent.equals(client.getMediaInfo().getContentId())||status==null)return;
        if(client.isPlaying()&&!accepted){accepted=true;listener.accepted();listener.message("Reproduzindo na TV. Toque em Transmitir para controlar ou desconectar.");}
        if(accepted)listener.progress(Math.max(0,client.getApproximateStreamPosition()/1000d),Math.max(0,client.getStreamDuration()/1000d),client.isPlaying(),status.getPlayerState()==MediaStatus.PLAYER_STATE_IDLE&&status.getIdleReason()==MediaStatus.IDLE_REASON_FINISHED);
        if(status.getPlayerState()==MediaStatus.PLAYER_STATE_IDLE&&status.getIdleReason()==MediaStatus.IDLE_REASON_ERROR){owned=false;listener.message("Esta fonte não pôde ser reproduzida na TV. Tente outro servidor.");}
    }
    private RemoteMediaClient client(){CastSession session=context==null?null:context.getSessionManager().getCurrentCastSession();return session!=null&&session.isConnected()?session.getRemoteMediaClient():null;}
    boolean owns(){return !dead&&owned&&client()!=null;}
    boolean control(String type,int seconds){if(!owns())return false;RemoteMediaClient c=client();if("toggle".equals(type)){if(c.isPlaying())c.pause();else c.play();}else if("seek".equals(type)&&media!=null&&!media.live)c.seek(new MediaSeekOptions.Builder().setPosition(Math.max(0,c.getApproximateStreamPosition()+seconds*1000L)).build());return true;}
    void clear(){key="";media=null;owned=false;accepted=false;requested=false;sent="";}
    void destroy(){dead=true;handler.removeCallbacksAndMessages(null);if(registered!=null)registered.unregisterCallback(callback);if(context!=null)context.getSessionManager().removeSessionManagerListener(this,CastSession.class);executor.shutdown();}
    @Override public void onSessionStarted(CastSession session,String id){if(media!=null)load(session);}
    @Override public void onSessionResumed(CastSession session,boolean suspended){if(media!=null&&!media.url.equals(sent))load(session);}
    @Override public void onSessionStartFailed(CastSession session,int error){listener.message("Não foi possível conectar à TV. Confira se os dois aparelhos estão na mesma rede Wi-Fi.");}
    @Override public void onSessionEnded(CastSession session,int error){owned=false;accepted=false;sent="";listener.message("Transmissão encerrada. Você pode continuar no celular.");}
    @Override public void onSessionResumeFailed(CastSession session,int error){owned=false;listener.message("Não foi possível retomar a conexão com a TV.");}
    @Override public void onSessionStarting(CastSession session){}
    @Override public void onSessionEnding(CastSession session){}
    @Override public void onSessionResuming(CastSession session,String id){}
    @Override public void onSessionSuspended(CastSession session,int reason){}
}
