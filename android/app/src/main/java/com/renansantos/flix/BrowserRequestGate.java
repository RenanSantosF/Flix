package com.renansantos.flix;

import java.util.LinkedHashMap;
import java.util.function.LongSupplier;

/** Holds exact GET resources already refused with 429; Chromium owns each request. */
final class BrowserRequestGate {
    private static final long MAX_WAIT=300000;
    private static final class Entry {
        long until; int pending, epoch; boolean retried, terminal, stale;
        Entry(long until){this.until=until;}
    }
    private final LinkedHashMap<String,Entry> limits=new LinkedHashMap<>();
    private final LongSupplier clock;
    private String source="";
    private int generation, held;
    private boolean visible=true;
    BrowserRequestGate(LongSupplier clock){this.clock=clock;}
    synchronized void clear(){generation++;source="";limits.clear();held=0;notifyAll();}
    synchronized void visible(boolean value){visible=value;if(!value)generation++;notifyAll();}
    synchronized void source(String value){
        String next=key(value);if(next.equals(source))return;
        Entry old=limits.get(source);if(old!=null){old.stale=true;old.epoch++;}
        source=next;Entry current=limits.get(source);if(current!=null)current.stale=false;notifyAll();
    }
    /** True after a second refusal of this exact source, or an impractically long wait. */
    synchronized boolean limited(String value,MediaRateLimit.Deadline deadline){
        if(!MediaUrlPolicy.allowed(value)||deadline==null)return false;
        String url=key(value);Entry entry=limits.get(url);
        if(entry==null){if(limits.size()>=32)limits.remove(limits.keySet().iterator().next());entry=new Entry(deadline.until);limits.put(url,entry);}
        String host=java.net.URI.create(url).getHost();
        for(java.util.Map.Entry<String,Entry> item:limits.entrySet())
            if(host.equalsIgnoreCase(java.net.URI.create(item.getKey()).getHost()))item.getValue().until=Math.max(item.getValue().until,deadline.until);
        entry.until=Math.max(entry.until,deadline.until);
        entry.terminal=entry.terminal||entry.retried||entry.until-clock.getAsLong()>MAX_WAIT;
        notifyAll();return entry.terminal&&url.equals(source);
    }
    synchronized boolean terminal(){Entry entry=limits.get(source);return entry!=null&&entry.terminal;}
    synchronized boolean ownsRetry(String value){Entry entry=limits.get(key(value));return entry!=null&&(entry.pending>0||entry.retried);}
    synchronized void appRetry(String value){Entry entry=limits.get(key(value));if(entry!=null)entry.retried=true;}
    synchronized int held(){return held;}
    /** Called on WebView's request worker, never the UI thread. False cancels stale work. */
    synchronized boolean await(String value,Runnable waiting){
        String url=key(value);Entry entry=limits.get(url);
        if(entry==null)return true;
        if(entry.stale||(entry.terminal&&url.equals(source)))return false;
        if(entry.until-clock.getAsLong()>MAX_WAIT)return false;
        if(entry.until<=clock.getAsLong()){entry.retried=true;return true;}
        if(!visible)return false;
        int version=generation,epoch=entry.epoch;entry.pending++;held++;waiting.run();
        try {
            while(visible&&generation==version&&entry.epoch==epoch&&!entry.stale&&!(entry.terminal&&url.equals(source))){
                long remaining=entry.until-clock.getAsLong();
                if(remaining<=0){entry.retried=true;return true;}
                wait(Math.min(remaining,250));
            }
            return false;
        }catch(InterruptedException e){Thread.currentThread().interrupt();return false;}
        finally{entry.pending--;}
    }
    private static String key(String value){if(value==null)return "";int fragment=value.indexOf('#');return fragment<0?value:value.substring(0,fragment);}
}
