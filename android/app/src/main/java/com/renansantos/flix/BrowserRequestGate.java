package com.renansantos.flix;

import java.util.LinkedHashMap;
import java.util.function.LongSupplier;

/** Holds only a current video URL already refused with 429; Chromium owns the request. */
final class BrowserRequestGate {
    private static final long MAX_WAIT=300000;
    private static final class Entry {
        long until; int pending; boolean retried, terminal;
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
    synchronized void source(String value){String next=key(value);if(!next.equals(source)){source=next;generation++;notifyAll();}}
    /** True after a second refusal of this exact source, or an impractically long wait. */
    synchronized boolean limited(String value,MediaRateLimit.Deadline deadline){
        if(!MediaUrlPolicy.allowed(value)||deadline==null)return false;
        String url=key(value);Entry entry=limits.get(url);
        if(entry==null){if(limits.size()>=32)limits.remove(limits.keySet().iterator().next());entry=new Entry(deadline.until);limits.put(url,entry);}
        entry.until=Math.max(entry.until,deadline.until);
        entry.terminal=entry.terminal||entry.retried||entry.until-clock.getAsLong()>MAX_WAIT;
        notifyAll();return entry.terminal&&url.equals(source);
    }
    synchronized boolean terminal(){Entry entry=limits.get(source);return entry!=null&&entry.terminal;}
    synchronized boolean ownsRetry(String value){Entry entry=limits.get(key(value));return key(value).equals(source)&&(entry!=null&&(entry.pending>0||entry.retried));}
    synchronized void appRetry(String value){Entry entry=limits.get(key(value));if(entry!=null)entry.retried=true;}
    synchronized int held(){return held;}
    /** Called on WebView's request worker, never the UI thread. False cancels stale work. */
    synchronized boolean await(String value,Runnable waiting){
        String url=key(value);Entry entry=limits.get(url);
        if(!url.equals(source)||entry==null)return true;
        if(!visible||entry.terminal)return false;
        if(entry.until<=clock.getAsLong())return true;
        int version=generation;entry.pending++;held++;waiting.run();
        try {
            while(visible&&generation==version&&url.equals(source)&&!entry.terminal){
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
