package com.renansantos.flix;

import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Bounded, in-memory playback evidence. Never displays URLs or raw console text. */
final class BrowserDiagnostics {
    private final LinkedHashSet<String> signals=new LinkedHashSet<>();
    private final LinkedHashMap<String,Integer> http=new LinkedHashMap<>();
    private String currentSource="",frame="",state="estado do vídeo ainda não informado";
    synchronized void clear(){signals.clear();http.clear();currentSource="";frame="";state="estado do vídeo ainda não informado";}
    synchronized void http(String url,int code){http(url,code,"","");}
    synchronized void http(String url,int code,String destination,String mime){
        if(url==null||url.length()>4096||code<400||code>599)return;
        url=withoutFragment(url);
        if(http.size()>=32&&!http.containsKey(url))http.remove(http.keySet().iterator().next());
        http.put(url,code);add("HTTP "+code+" · "+host(url)+" · "+resource(destination,mime,url));
    }
    synchronized void retry(String source){if(source!=null)http.remove(withoutFragment(source));}
    synchronized void adLoading(){add("interface exibiu Loading ad");}
    synchronized void blockedFrame(String scheme){add("frame "+("http".equals(scheme)?"HTTP":"externo")+" bloqueado");}
    synchronized void network(int code){network(code,"","","");}
    synchronized void network(int code,String url,String destination,String description){
        if(code<-16||code>-1)return;
        Matcher m=Pattern.compile("(?:net::)?(ERR_[A-Z_]{1,60})").matcher(description==null?"":description);
        add("rede "+code+(m.find()?" "+m.group(1):"")+" · "+host(url)+" · "+resource(destination,"",url));
    }
    synchronized void console(String message){console(message,"",0,true);}
    synchronized void console(String message,String source,int line,boolean errorLevel){
        if(message==null)return;String s=message.substring(0,Math.min(8192,message.length())).toLowerCase(Locale.ROOT);
        if(s.contains("mixed content")&&(s.contains("blocked")||s.contains("insecure")))add("conteúdo HTTP bloqueado");
        else if(s.contains("cors policy")||s.contains("cross-origin request blocked"))add("CORS bloqueado");
        else if(s.contains("content security policy")||s.contains("frame-ancestors"))add("política CSP bloqueou recurso");
        else if(s.contains("notallowederror")||s.contains("user didn't interact")||s.contains("user gesture"))add("reprodução exige interação");
        else if(s.contains("net::err_cleartext_not_permitted"))add("HTTP recusado pelo Android");
        else if(s.contains("net::err_cert"))add("falha de certificado");
        else if(s.contains("net::err_blocked"))add("recurso bloqueado pelo WebView");
        else if(errorLevel&&(s.contains("typeerror")||s.contains("referenceerror")||s.contains("syntaxerror")||s.contains("securityerror")))
            add("erro JavaScript: "+jsError(message)+" @ "+host(source)+(line>0&&line<1000000?":"+line:""));
    }
    synchronized void state(String kind,int ready,int network){
        if(!kind.matches("https|http|blob|missing|other")||ready<0||ready>4||network<0||network>3)return;
        state="fonte "+kind+" · readyState "+ready+" · networkState "+network;
    }
    synchronized void source(String url,String origin){
        currentSource=url!=null&&url.length()<=4096&&MediaUrlPolicy.allowedNetwork(url)?withoutFragment(url):"";
        frame=host(origin);
    }
    synchronized String summary(String source){
        String candidate=source==null||source.isEmpty()?currentSource:withoutFragment(source);
        Integer status=http.get(candidate);String text="WebView: "+state;
        if(!frame.isEmpty()&&!"origem não informada".equals(frame))text+=" · frame "+frame;
        if(!currentSource.isEmpty())text+=" · mídia "+host(currentSource);
        if(status!=null)text+=(source==null||source.isEmpty()?" · fonte atual HTTP ":" · fonte original HTTP ")+status;
        for(String signal:signals)text+=" · "+signal;
        return text;
    }
    static String host(String url){
        try{URI u=URI.create(url);String h=u.getHost();return ("https".equalsIgnoreCase(u.getScheme())||"http".equalsIgnoreCase(u.getScheme()))&&u.getUserInfo()==null&&h!=null&&h.length()<=253&&h.matches("[a-zA-Z0-9.-]+")?h.toLowerCase(Locale.ROOT):"origem não informada";}catch(RuntimeException e){return "origem não informada";}
    }
    private static String withoutFragment(String url){int i=url.indexOf('#');return i<0?url:url.substring(0,i);}
    static String resource(String destination,String mime,String url){
        String d=destination==null?"":destination.toLowerCase(Locale.ROOT),m=mime==null?"":mime.toLowerCase(Locale.ROOT),path="";
        try{path=URI.create(url).getPath().toLowerCase(Locale.ROOT);}catch(RuntimeException ignored){}
        String type=d.equals("video")||d.equals("audio")||m.startsWith("video/")||m.startsWith("audio/")||path.matches(".*\\.(mp4|m3u8|mpd|webm|m4v)$")?"mídia":
            d.equals("script")||m.contains("javascript")||path.endsWith(".js")?"script":
            d.equals("iframe")||d.equals("document")?"documento":d.equals("image")||m.startsWith("image/")?"imagem":m.contains("xml")||path.endsWith(".xml")?"XML":"recurso";
        return type+(m.contains("html")?"/HTML":m.contains("json")?"/JSON":"");
    }
    static String jsError(String message){
        String s=message==null?"":message.substring(0,Math.min(8192,message.length()));
        s=s.replaceAll("(?i)https?://[^\\s<>\"']+","[URL]");
        Matcher read=Pattern.compile("Cannot read properties of (null|undefined).*?reading ['\"]([A-Za-z_$][A-Za-z0-9_$]{0,40})['\"]").matcher(s);
        if(read.find())return "TypeError: "+read.group(1)+"."+read.group(2);
        Matcher legacy=Pattern.compile("Cannot read property ['\"]([A-Za-z_$][A-Za-z0-9_$]{0,40})['\"] of (null|undefined)").matcher(s);
        if(legacy.find())return "TypeError: "+legacy.group(2)+"."+legacy.group(1);
        Matcher fn=Pattern.compile("([A-Za-z_$][A-Za-z0-9_$]{0,30}(?:\\.[A-Za-z_$][A-Za-z0-9_$]{0,30}){0,3}) is not a function").matcher(s);
        if(fn.find())return "TypeError: "+fn.group(1)+" não é função";
        Matcher ref=Pattern.compile("ReferenceError: ([A-Za-z_$][A-Za-z0-9_$]{0,40}) is not defined").matcher(s);
        if(ref.find())return "ReferenceError: "+ref.group(1)+" não definido";
        String lower=s.toLowerCase(Locale.ROOT);
        if(lower.contains("failed to fetch"))return "TypeError: fetch falhou";
        if(lower.contains("syntaxerror"))return lower.contains("unexpected token '<'")?"SyntaxError: resposta HTML":"SyntaxError";
        if(lower.contains("securityerror"))return "SecurityError";
        if(lower.contains("referenceerror"))return "ReferenceError";
        return "TypeError";
    }
    private void add(String signal){if(signals.size()<6||signals.contains(signal))signals.add(signal);}
}
