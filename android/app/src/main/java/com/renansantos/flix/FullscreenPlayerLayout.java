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
import android.widget.ImageButton;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.content.res.ColorStateList;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Native controls around the existing video surface; never replaces the media session. */
final class FullscreenPlayerLayout extends FrameLayout {
    interface Actions { void exit(); void toggle(); void seek(int seconds); default void pip(){} default void cast(){} }
    private final Activity activity;
    private final int previousOrientation;
    private final float previousBrightness;
    private final LinearLayout top, transport;
    private final ImageButton lock, toggle;
    private final TextView unlock, hint;
    private final View shade;
    private final TextView feedback;
    private final AudioManager audio;
    private boolean locked, pip, released, gesture, candidate, childCancelled, volumeSide, revealOnly;
    private float downX, downY, startBrightness;
    private int startVolume;
    private final Runnable hide = this::hideControls;
    private void hideControls(){
        fade(top,false);fade(transport,false);fade(unlock,false);fade(hint,false);fade(shade,false);feedback.setVisibility(GONE);
    }
    FullscreenPlayerLayout(Activity activity, View surface, Actions actions) {
        super(activity);this.activity=activity;
        previousOrientation=activity.getRequestedOrientation();previousBrightness=activity.getWindow().getAttributes().screenBrightness;
        audio=(AudioManager)activity.getSystemService(android.content.Context.AUDIO_SERVICE);
        setBackgroundColor(Color.BLACK);addView(surface,new LayoutParams(-1,-1));
        shade=new View(activity);shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0xb8000000,0x18000000,0x88000000}));addView(shade,new LayoutParams(-1,-1));
        top=new LinearLayout(activity);top.setPadding(dp(18),dp(6),dp(18),dp(6));top.setGravity(Gravity.CENTER_VERTICAL);
        ImageButton back=icon("back","Sair da tela cheia",false,v->actions.exit());top.addView(back,new LinearLayout.LayoutParams(dp(48),dp(48)));
        TextView brand=new TextView(activity);brand.setText("FLIX ·");brand.setTextSize(19);brand.setTypeface(android.graphics.Typeface.create("sans-serif-black",0));brand.setTextColor(Color.WHITE);brand.setPadding(dp(18),0,0,0);top.addView(brand,new LinearLayout.LayoutParams(0,-2,1));
        top.addView(icon("cast","Transmitir para TV",false,v->{actions.cast();showControls();}),new LinearLayout.LayoutParams(dp(48),dp(48)));
        top.addView(icon("pip","Janela flutuante",false,v->actions.pip()),new LinearLayout.LayoutParams(dp(48),dp(48)));
        lock=icon("lock","Bloquear toque",false,v->setLocked(true));top.addView(lock,new LinearLayout.LayoutParams(dp(48),dp(48)));
        addView(top,new LayoutParams(-1,dp(64),Gravity.TOP));
        transport=new LinearLayout(activity);transport.setGravity(Gravity.CENTER);
        ImageButton previous=icon("rewind","Voltar 10 segundos",false,v->{actions.seek(-10);showControls();});
        toggle=icon("pause","Pausar vídeo",true,v->{actions.toggle();showControls();});
        ImageButton next=icon("forward","Avançar 10 segundos",false,v->{actions.seek(10);showControls();});
        LinearLayout.LayoutParams side=new LinearLayout.LayoutParams(dp(56),dp(56));side.setMargins(dp(24),0,dp(24),0);transport.addView(previous,side);transport.addView(toggle,new LinearLayout.LayoutParams(dp(76),dp(76)));transport.addView(next,side);
        addView(transport,new LayoutParams(-2,dp(88),Gravity.CENTER));
        hint=new TextView(activity);hint.setText("BRILHO À ESQUERDA  ·  VOLUME À DIREITA");hint.setTextSize(10);hint.setLetterSpacing(.08f);hint.setTextColor(0xffccccd5);hint.setGravity(Gravity.CENTER);
        LayoutParams caption=new LayoutParams(-1,dp(30),Gravity.BOTTOM);caption.bottomMargin=dp(12);addView(hint,caption);
        unlock=new TextView(activity);unlock.setText("Desbloquear toque");unlock.setTextColor(Color.WHITE);unlock.setTextSize(13);unlock.setTypeface(android.graphics.Typeface.create("sans-serif-medium",0));unlock.setGravity(Gravity.CENTER);unlock.setPadding(dp(18),0,dp(20),0);unlock.setBackground(pill(0xe622222a));PlayerGlyph glyph=new PlayerGlyph("unlock",Color.WHITE);glyph.setBounds(0,0,dp(20),dp(20));unlock.setCompoundDrawables(glyph,null,null,null);unlock.setCompoundDrawablePadding(dp(10));unlock.setContentDescription("Desbloquear toque");unlock.setOnClickListener(v->setLocked(false));unlock.setVisibility(GONE);
        LayoutParams unlockPlace=new LayoutParams(-2,dp(48),Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);unlockPlace.bottomMargin=dp(24);addView(unlock,unlockPlace);
        feedback=new TextView(activity);feedback.setTextSize(18);feedback.setTextColor(Color.WHITE);feedback.setGravity(Gravity.CENTER);feedback.setBackground(pill(0xdd18181e));feedback.setPadding(dp(24),dp(14),dp(24),dp(14));feedback.setVisibility(GONE);addView(feedback,new LayoutParams(-2,-2,Gravity.CENTER));
        activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);immersive();showControls();
    }
    private android.graphics.drawable.Drawable pill(int color){GradientDrawable shape=new GradientDrawable();shape.setColor(color);shape.setCornerRadius(dp(40));shape.setStroke(dp(1),0x28ffffff);return new RippleDrawable(ColorStateList.valueOf(0x44ffffff),shape,null);}
    private ImageButton icon(String kind,String label,boolean primary,OnClickListener listener){ImageButton b=new ImageButton(activity);b.setContentDescription(label);b.setTooltipText(label);b.setPadding(dp(primary?21:13),dp(primary?21:13),dp(primary?21:13),dp(primary?21:13));b.setImageDrawable(new PlayerGlyph(kind,primary?Color.BLACK:Color.WHITE));b.setBackground(pill(primary?Color.WHITE:0x50181820));b.setOnClickListener(listener);return b;}
    private void fade(View view,boolean visible){view.animate().cancel();if(visible){view.setVisibility(VISIBLE);view.animate().alpha(1).setDuration(150).start();}else if(view.getVisibility()==VISIBLE)view.animate().alpha(0).setDuration(180).withEndAction(()->view.setVisibility(GONE)).start();}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private void immersive(){activity.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);}
    void showControls(){if(pip||released)return;fade(top,!locked);fade(transport,!locked);fade(hint,!locked);fade(shade,!locked);fade(unlock,locked);removeCallbacks(hide);postDelayed(hide,locked?2500:3000);}
    void setLocked(boolean value){locked=value;showControls();}
    boolean isLocked(){return locked;}
    boolean isUnlockVisible(){return unlock.getVisibility()==VISIBLE&&unlock.getAlpha()>.5f;}
    void playing(boolean playing){toggle.setImageDrawable(new PlayerGlyph(playing?"pause":"play",Color.BLACK));toggle.setContentDescription(playing?"Pausar vídeo":"Reproduzir vídeo");}
    void pip(boolean active){pip=active;removeCallbacks(hide);feedback.setVisibility(GONE);if(active){for(View v:new View[]{top,transport,unlock,hint,shade}){v.animate().cancel();v.setVisibility(GONE);}activity.setRequestedOrientation(previousOrientation);restoreBrightness();}else{activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);immersive();showControls();}}
    void release(){if(released)return;released=true;removeCallbacks(hide);for(View v:new View[]{top,transport,unlock,hint,shade})v.animate().cancel();restoreBrightness();activity.setRequestedOrientation(previousOrientation);activity.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);}
    private void restoreBrightness(){WindowManager.LayoutParams params=activity.getWindow().getAttributes();params.screenBrightness=previousBrightness;activity.getWindow().setAttributes(params);}
    @Override public boolean dispatchTouchEvent(MotionEvent event){
        if(pip)return super.dispatchTouchEvent(event);
        int action=event.getActionMasked();
        if(locked){
            if(action==MotionEvent.ACTION_DOWN){downX=event.getX();downY=event.getY();revealOnly=!isUnlockVisible();}
            if(!revealOnly&&unlock.getVisibility()==VISIBLE&&event.getX()>=unlock.getLeft()&&event.getX()<=unlock.getRight()&&event.getY()>=unlock.getTop()&&event.getY()<=unlock.getBottom())return super.dispatchTouchEvent(event);
            if(action==MotionEvent.ACTION_UP&&Math.abs(event.getX()-downX)<dp(18)&&Math.abs(event.getY()-downY)<dp(18))showControls();return true;
        }
        if(action==MotionEvent.ACTION_DOWN){downX=event.getX();downY=event.getY();revealOnly=top.getVisibility()!=VISIBLE;gesture=false;childCancelled=false;candidate=downY>dp(72)&&downY<getHeight()-dp(72)&&(downX<getWidth()*.2f||downX>getWidth()*.8f);volumeSide=downX>getWidth()/2f;startVolume=audio.getStreamVolume(AudioManager.STREAM_MUSIC);startBrightness=activity.getWindow().getAttributes().screenBrightness;if(startBrightness<0)startBrightness=Settings.System.getInt(activity.getContentResolver(),Settings.System.SCREEN_BRIGHTNESS,128)/255f;}
        if(action==MotionEvent.ACTION_MOVE&&candidate&&event.getPointerCount()==1){float dy=downY-event.getY(),dx=event.getX()-downX;if(!gesture&&Math.abs(dy)>ViewConfiguration.get(activity).getScaledTouchSlop()*2&&Math.abs(dy)>Math.abs(dx)*1.5f)gesture=true;
            if(gesture){if(!childCancelled){MotionEvent cancel=MotionEvent.obtain(event);cancel.setAction(MotionEvent.ACTION_CANCEL);super.dispatchTouchEvent(cancel);cancel.recycle();childCancelled=true;}float delta=dy/Math.max(1,getHeight()*.7f);String label;
                if(volumeSide){int max=audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC),value=Math.max(0,Math.min(max,Math.round(startVolume+delta*max)));if(!audio.isVolumeFixed())try{audio.setStreamVolume(AudioManager.STREAM_MUSIC,value,0);}catch(SecurityException ignored){}label="Volume "+Math.round(value*100f/Math.max(1,max))+"%";}
                else{WindowManager.LayoutParams params=activity.getWindow().getAttributes();params.screenBrightness=Math.max(.05f,Math.min(1,startBrightness+delta));activity.getWindow().setAttributes(params);label="Brilho "+Math.round(params.screenBrightness*100)+"%";}
                feedback.setText(label);feedback.setVisibility(VISIBLE);removeCallbacks(hide);return true;}}
        if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL){if(gesture){gesture=false;feedback.setVisibility(GONE);showControls();return true;}if(action==MotionEvent.ACTION_UP&&revealOnly){MotionEvent cancel=MotionEvent.obtain(event);cancel.setAction(MotionEvent.ACTION_CANCEL);super.dispatchTouchEvent(cancel);cancel.recycle();showControls();return true;}showControls();}
        return super.dispatchTouchEvent(event);
    }
}
