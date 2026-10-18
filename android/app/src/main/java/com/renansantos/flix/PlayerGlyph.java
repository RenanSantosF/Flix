package com.renansantos.flix;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;

/** Small vector glyphs, independent of system button styling and fonts. */
final class PlayerGlyph extends Drawable {
    private final String kind;private final int color;private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
    PlayerGlyph(String kind,int color){this.kind=kind;this.color=color;}
    @Override public void draw(Canvas canvas){int save=canvas.save();canvas.translate(getBounds().left,getBounds().top);canvas.scale(getBounds().width()/24f,getBounds().height()/24f);p.setColor(color);p.setStrokeWidth(1.8f);p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);
        Path path=new Path();
        switch(kind){
            case "back":path.moveTo(14,5);path.lineTo(7,12);path.lineTo(14,19);canvas.drawPath(path,p);break;
            case "play":p.setStyle(Paint.Style.FILL);path.moveTo(9,5);path.lineTo(20,12);path.lineTo(9,19);path.close();canvas.drawPath(path,p);break;
            case "pause":p.setStyle(Paint.Style.FILL);canvas.drawRoundRect(6,5,10,19,1,1,p);canvas.drawRoundRect(14,5,18,19,1,1,p);break;
            case "pip":canvas.drawRoundRect(2,4,22,20,2,2,p);p.setStyle(Paint.Style.FILL);canvas.drawRoundRect(12,11,19,17,1,1,p);break;
            case "lock":case "unlock":canvas.drawRoundRect(5,10,19,21,2,2,p);canvas.drawArc(8,2,16,15,180,kind.equals("lock")?180:130,false,p);canvas.drawLine(12,14,12,17,p);break;
            case "cast":path.moveTo(3,8);path.lineTo(3,4);path.lineTo(22,4);path.lineTo(22,19);path.lineTo(14,19);canvas.drawPath(path,p);break;
            default:canvas.drawArc(3,3,21,21,kind.equals("rewind")?145:35,280,false,p);path.moveTo(kind.equals("rewind")?3:21,3);path.lineTo(kind.equals("rewind")?3:21,9);path.lineTo(kind.equals("rewind")?9:15,9);canvas.drawPath(path,p);p.setStyle(Paint.Style.FILL);p.setTextSize(8);p.setTypeface(android.graphics.Typeface.create("sans-serif-medium",android.graphics.Typeface.NORMAL));p.setTextAlign(Paint.Align.CENTER);canvas.drawText("10",12,16,p);
        }
        if(kind.equals("cast")){p.setStyle(Paint.Style.STROKE);p.setColor(color);canvas.drawArc(-6,12,12,30,270,90,false,p);canvas.drawArc(-3,15,6,24,270,90,false,p);p.setStyle(Paint.Style.FILL);canvas.drawCircle(1,22,1.3f,p);}
        canvas.restoreToCount(save);
    }
    @Override public void setAlpha(int alpha){p.setAlpha(alpha);}
    @Override public void setColorFilter(ColorFilter filter){p.setColorFilter(filter);}
    @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
}
