package com.renansantos.flix;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.media.AudioManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Native controls around the existing video surface; never replaces the media session. */
final class FullscreenPlayerLayout extends FrameLayout {
    interface Actions { void exit(); void toggle(); void seek(int seconds); default void pip(){} }
    private final Activity activity;
    private final int previousOrientation;
    private final float previousBrightness;
    private final LinearLayout top, transport;
    private final Button lock, toggle;
    private final TextView feedback;
    private final AudioManager audio;
    private boolean locked, pip, released, gesture, candidate, childCancelled, volumeSide;
    private float downX, downY, startBrightness;
    private int startVolume;
    private final Runnable hide = this::hideControls;
    private void hideControls(){if(!locked){top.setVisibility(GONE);transport.setVisibility(GONE);}feedback.setVisibility(GONE);}

    FullscreenPlayerLayout(Activity activity, View surface, Actions actions) {
        super(activity);this.activity=activity;
        previousOrientation=activity.getRequestedOrientation();previousBrightness=activity.getWindow().getAttributes().screenBrightness;
        audio=(AudioManager)activity.getSystemService(android.content.Context.AUDIO_SERVICE);
        setBackgroundColor(Color.BLACK);addView(surface,new LayoutParams(-1,-1));
        top=new LinearLayout(activity);top.setPadding(dp(16),dp(8),dp(16),dp(8));top.setGravity(Gravity.CENTER_VERTICAL);top.setBackgroundColor(0xb3000000);
        Button back=button("Sair da tela cheia",v->actions.exit());top.addView(back,new LinearLayout.LayoutParams(-2,dp(48)));
        TextView hint=new TextView(activity);hint.setText("Deslize nas laterais: brilho · volume");hint.setTextColor(Color.LTGRAY);hint.setGravity(Gravity.CENTER);top.addView(hint,new LinearLayout.LayoutParams(0,-2,1));
        Button floating=button("Janela flutuante",v->actions.pip());top.addView(floating,new LinearLayout.LayoutParams(-2,dp(48)));
        lock=button("Bloquear toque",v->setLocked(!locked));top.addView(lock,new LinearLayout.LayoutParams(-2,dp(48)));
        addView(top,new LayoutParams(-1,dp(64),Gravity.TOP));
        transport=new LinearLayout(activity);transport.setGravity(Gravity.CENTER);transport.setBackgroundColor(0xb3000000);
        Button previous=button("↶ 10 s",v->{actions.seek(-10);showControls();});previous.setContentDescription("Voltar 10 segundos");
        toggle=button("Pausar / reproduzir",v->{actions.toggle();showControls();});
        Button next=button("10 s ↷",v->{actions.seek(10);showControls();});next.setContentDescription("Avançar 10 segundos");
        transport.addView(previous,new LinearLayout.LayoutParams(dp(112),dp(52)));transport.addView(toggle,new LinearLayout.LayoutParams(dp(176),dp(52)));transport.addView(next,new LinearLayout.LayoutParams(dp(112),dp(52)));
        LayoutParams bottom=new LayoutParams(-1,dp(64),Gravity.BOTTOM);addView(transport,bottom);
        feedback=new TextView(activity);feedback.setTextSize(22);feedback.setTextColor(Color.WHITE);feedback.setGravity(Gravity.CENTER);feedback.setBackgroundColor(0xc0000000);feedback.setPadding(dp(20),dp(12),dp(20),dp(12));feedback.setVisibility(GONE);
        addView(feedback,new LayoutParams(-2,-2,Gravity.CENTER));
        activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        immersive();showControls();
    }
    private Button button(String label,OnClickListener listener){Button b=new Button(activity);b.setText(label);b.setTextColor(Color.WHITE);b.setTextSize(15);b.setAllCaps(false);b.setOnClickListener(listener);return b;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private void immersive(){activity.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);}
    void showControls(){if(pip)return;top.setVisibility(VISIBLE);transport.setVisibility(locked?GONE:VISIBLE);removeCallbacks(hide);if(!locked)postDelayed(hide,4500);}
    void setLocked(boolean value){locked=value;lock.setText(value?"Desbloquear toque":"Bloquear toque");for(int i=0;i<top.getChildCount();i++)if(top.getChildAt(i)!=lock)top.getChildAt(i).setVisibility(value?GONE:VISIBLE);showControls();}
    boolean isLocked(){return locked;}
    void playing(boolean playing){toggle.setText(playing?"Pausar":"Reproduzir");toggle.setContentDescription(playing?"Pausar vídeo":"Reproduzir vídeo");}
    void pip(boolean active){pip=active;removeCallbacks(hide);feedback.setVisibility(GONE);if(active){top.setVisibility(GONE);transport.setVisibility(GONE);activity.setRequestedOrientation(previousOrientation);restoreBrightness();}else{activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);immersive();showControls();}}
    void release(){if(released)return;released=true;removeCallbacks(hide);restoreBrightness();activity.setRequestedOrientation(previousOrientation);activity.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);}
    private void restoreBrightness(){WindowManager.LayoutParams params=activity.getWindow().getAttributes();params.screenBrightness=previousBrightness;activity.getWindow().setAttributes(params);}
    @Override public boolean dispatchTouchEvent(MotionEvent event){
        if(pip)return super.dispatchTouchEvent(event);
        int action=event.getActionMasked();
        if(locked){if(event.getY()<dp(64))return super.dispatchTouchEvent(event);return true;}
        if(action==MotionEvent.ACTION_DOWN){downX=event.getX();downY=event.getY();gesture=false;childCancelled=false;candidate=downY>dp(72)&&downY<getHeight()-dp(72)&&(downX<getWidth()*.2f||downX>getWidth()*.8f);volumeSide=downX>getWidth()/2f;startVolume=audio.getStreamVolume(AudioManager.STREAM_MUSIC);startBrightness=activity.getWindow().getAttributes().screenBrightness;if(startBrightness<0)startBrightness=Settings.System.getInt(activity.getContentResolver(),Settings.System.SCREEN_BRIGHTNESS,128)/255f;}
        if(action==MotionEvent.ACTION_MOVE&&candidate&&event.getPointerCount()==1){float dy=downY-event.getY(),dx=event.getX()-downX;if(!gesture&&Math.abs(dy)>ViewConfiguration.get(activity).getScaledTouchSlop()*2&&Math.abs(dy)>Math.abs(dx)*1.5f)gesture=true;
            if(gesture){if(!childCancelled){MotionEvent cancel=MotionEvent.obtain(event);cancel.setAction(MotionEvent.ACTION_CANCEL);super.dispatchTouchEvent(cancel);cancel.recycle();childCancelled=true;}float delta=dy/Math.max(1,getHeight()*.7f);String label;
                if(volumeSide){int max=audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC),value=Math.max(0,Math.min(max,Math.round(startVolume+delta*max)));if(!audio.isVolumeFixed())try{audio.setStreamVolume(AudioManager.STREAM_MUSIC,value,0);}catch(SecurityException ignored){}label="Volume "+Math.round(value*100f/Math.max(1,max))+"%";}
                else{WindowManager.LayoutParams params=activity.getWindow().getAttributes();params.screenBrightness=Math.max(.05f,Math.min(1,startBrightness+delta));activity.getWindow().setAttributes(params);label="Brilho "+Math.round(params.screenBrightness*100)+"%";}
                feedback.setText(label);feedback.setVisibility(VISIBLE);removeCallbacks(hide);return true;}}
        if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL){if(gesture){gesture=false;feedback.setVisibility(GONE);showControls();return true;}if(action==MotionEvent.ACTION_UP&&top.getVisibility()!=VISIBLE){MotionEvent cancel=MotionEvent.obtain(event);cancel.setAction(MotionEvent.ACTION_CANCEL);super.dispatchTouchEvent(cancel);cancel.recycle();showControls();return true;}showControls();}
        return super.dispatchTouchEvent(event);
    }
}
