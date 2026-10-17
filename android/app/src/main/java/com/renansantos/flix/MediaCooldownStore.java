package com.renansantos.flix;
import android.content.SharedPreferences;

/** Only public hostnames and deadlines survive reloads; signed URLs are never saved. */
final class MediaCooldownStore implements MediaRateLimit.Store {
    private final SharedPreferences preferences;
    MediaCooldownStore(SharedPreferences preferences){this.preferences=preferences;}
    public synchronized MediaRateLimit.Deadline get(String host) {
        long until=preferences.getLong(host,0);return until==0?null:new MediaRateLimit.Deadline(until,preferences.getBoolean(host+"|supplied",false));
    }
    public synchronized void put(String host,MediaRateLimit.Deadline deadline) {
        SharedPreferences.Editor edit=preferences.edit();long now=System.currentTimeMillis();
        for(java.util.Map.Entry<String,?> entry:preferences.getAll().entrySet())if(entry.getValue() instanceof Long&&(Long)entry.getValue()<=now)
            edit.remove(entry.getKey()).remove(entry.getKey()+"|supplied");
        edit.putLong(host,deadline.until).putBoolean(host+"|supplied",deadline.supplied).apply();
    }
}
