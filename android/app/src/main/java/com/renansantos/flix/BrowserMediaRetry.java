package com.renansantos.flix;

import java.util.LinkedHashMap;

/** One browser retry of an exact, already requested source, after Retry-After. */
final class BrowserMediaRetry {
    private final LinkedHashMap<String,MediaRateLimit.Deadline> limits=new LinkedHashMap<>();
    private boolean attempted;
    void clear(){limits.clear();attempted=false;}
    void succeeded(){limits.clear();}
    void limited(String source,MediaRateLimit.Deadline deadline){
        if(!MediaUrlPolicy.allowed(source)||deadline==null)return;
        source=key(source);
        if(limits.size()>=32&&!limits.containsKey(source))limits.remove(limits.keySet().iterator().next());
        String host=java.net.URI.create(source).getHost();
        for(java.util.Map.Entry<String,MediaRateLimit.Deadline> entry:limits.entrySet())
            if(host.equalsIgnoreCase(java.net.URI.create(entry.getKey()).getHost())&&entry.getValue().until>deadline.until)deadline=entry.getValue();
        // A later response on this host must also postpone an already scheduled URL.
        for(java.util.Map.Entry<String,MediaRateLimit.Deadline> entry:limits.entrySet())
            if(host.equalsIgnoreCase(java.net.URI.create(entry.getKey()).getHost()))entry.setValue(deadline);
        limits.put(source,deadline);
    }
    boolean isLimited(String source){return limits.containsKey(key(source));}
    long waitMillis(String source,long now){
        MediaRateLimit.Deadline deadline=limits.get(key(source));
        if(attempted||deadline==null)return -1;
        long remaining=Math.max(0,deadline.until-now);
        return remaining<=300000?remaining:-1;
    }
    boolean consume(String source,long now){
        if(waitMillis(source,now)!=0)return false;
        attempted=true;return true;
    }
    private static String key(String source){if(source==null)return "";int i=source.indexOf('#');return i<0?source:source.substring(0,i);}
}
