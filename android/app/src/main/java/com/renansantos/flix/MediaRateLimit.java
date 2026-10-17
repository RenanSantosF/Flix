package com.renansantos.flix;

import java.io.IOException;
import java.math.BigInteger;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import okhttp3.Interceptor;
import okhttp3.Response;

/** Stores a cooldown deadline, never caches a 429 response or changes server identity. */
final class MediaRateLimit implements Interceptor {
    static final long DEFAULT_WAIT_MS=60000;
    static final class Deadline {
        final long until;final boolean supplied;
        Deadline(long until,boolean supplied){this.until=until;this.supplied=supplied;}
    }
    interface Store {Deadline get(String host);void put(String host,Deadline deadline);}
    static final class MemoryStore implements Store {
        private final ConcurrentHashMap<String,Deadline> values=new ConcurrentHashMap<>();
        public Deadline get(String host){return values.get(host);}public void put(String host,Deadline value){values.put(host,value);}
    }
    static final class Limited extends IOException {
        final String host;final Deadline deadline;
        Limited(String host,Deadline deadline){super("HTTP 429: media cooldown");this.host=host;this.deadline=deadline;}
    }
    private final Store store;private final LongSupplier clock;
    MediaRateLimit(Store store,LongSupplier clock){this.store=store;this.clock=clock;}
    @Override public Response intercept(Chain chain) throws IOException {
        String host=chain.request().url().host();Deadline previous=store.get(host);long now=clock.getAsLong();
        if(previous!=null&&previous.until>now)throw new Limited(host,previous);
        Response response=chain.proceed(chain.request());
        if(response.code()!=429)return response;
        Deadline deadline=parse(response.header("Retry-After"),response.header("Date"),clock.getAsLong());
        store.put(host,deadline);response.close();throw new Limited(host,deadline);
    }
    static Deadline parse(String retryAfter,String serverDate,long now) {
        long delay=DEFAULT_WAIT_MS;boolean supplied=false;
        if(retryAfter!=null) {
            String value=retryAfter.trim();
            try {
                if(value.matches("[0-9]{1,30}")) {
                    BigInteger millis=new BigInteger(value).multiply(BigInteger.valueOf(1000));
                    delay=millis.min(BigInteger.valueOf(Long.MAX_VALUE)).longValue();supplied=true;
                } else {
                    long until=httpDate(value);
                    long reference=now;
                    if(serverDate!=null)try{reference=httpDate(serverDate);}catch(RuntimeException ignored){}
                    delay=Math.max(0,Math.subtractExact(until,reference));supplied=true;
                }
            }catch(RuntimeException ignored){}
        }
        return new Deadline(delay>Long.MAX_VALUE-now?Long.MAX_VALUE:now+delay,supplied);
    }
    private static long httpDate(String value) {
        try{return ZonedDateTime.parse(value,DateTimeFormatter.RFC_1123_DATE_TIME).toInstant().toEpochMilli();}catch(RuntimeException ignored){}
        for(String pattern:new String[]{"EEEE, dd-MMM-yy HH:mm:ss zzz","EEE MMM d HH:mm:ss yyyy"}) {
            java.text.SimpleDateFormat format=new java.text.SimpleDateFormat(pattern,java.util.Locale.US);format.setLenient(false);format.setTimeZone(java.util.TimeZone.getTimeZone("GMT"));
            java.util.Calendar start=java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("GMT"));start.add(java.util.Calendar.YEAR,-50);format.set2DigitYearStart(start.getTime());
            java.text.ParsePosition position=new java.text.ParsePosition(0);java.util.Date parsed=format.parse(value,position);
            if(parsed!=null&&position.getIndex()==value.length())return parsed.getTime();
        }
        throw new IllegalArgumentException("Invalid HTTP date");
    }
    static Limited find(Throwable error) {
        for(int i=0;i<16&&error!=null;i++,error=error.getCause())if(error instanceof Limited)return (Limited)error;
        return null;
    }
    static long seconds(Deadline deadline,long now){long remaining=Math.max(0,deadline.until-now);return remaining/1000+(remaining%1000==0?0:1);}
    static String message(Limited limited,long now) {
        return "O provedor limitou as requisições (HTTP 429 · "+limited.host+"). Aguarde "+seconds(limited.deadline,now)+" s."
            +(limited.deadline.supplied?" Prazo informado pelo servidor.":" O servidor não informou o prazo; espera inicial de 60 s.");
    }
}
