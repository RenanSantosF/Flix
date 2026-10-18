package com.renansantos.flix;

import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.Locale;

/** Bounded, in-memory playback evidence. Never displays URLs or raw console text. */
final class BrowserDiagnostics {
    private final LinkedHashSet<String> signals=new LinkedHashSet<>();
    private final LinkedHashMap<String,Integer> http=new LinkedHashMap<>();
    private String state="estado do vídeo ainda não informado";
    synchronized void clear(){signals.clear();http.clear();state="estado do vídeo ainda não informado";}
    synchronized void http(String url,int code){
        if(url==null||url.length()>4096||code<400||code>599)return;
        if(http.size()>=32&&!http.containsKey(url))http.remove(http.keySet().iterator().next());
        http.put(url,code);add("recurso HTTP "+code);
    }
    synchronized void adLoading(){add("interface exibiu Loading ad");}
    synchronized void blockedFrame(String scheme){add("frame "+("http".equals(scheme)?"HTTP":"externo")+" bloqueado");}
    synchronized void network(int code){if(code>=-16&&code<=-1)add("erro de rede WebView "+code);}
    synchronized void console(String message){
        if(message==null)return;String s=message.substring(0,Math.min(8192,message.length())).toLowerCase(Locale.ROOT);
        if(s.contains("mixed content")&&(s.contains("blocked")||s.contains("insecure")))add("conteúdo HTTP bloqueado");
        else if(s.contains("cors policy")||s.contains("cross-origin request blocked"))add("CORS bloqueado");
        else if(s.contains("content security policy")||s.contains("frame-ancestors"))add("política CSP bloqueou recurso");
        else if(s.contains("notallowederror")||s.contains("user didn't interact")||s.contains("user gesture"))add("reprodução exige interação");
        else if(s.contains("net::err_cleartext_not_permitted"))add("HTTP recusado pelo Android");
        else if(s.contains("net::err_cert"))add("falha de certificado");
        else if(s.contains("net::err_blocked"))add("recurso bloqueado pelo WebView");
        else if(s.contains("typeerror")||s.contains("referenceerror")||s.contains("syntaxerror"))add("erro JavaScript no player");
    }
    synchronized void state(String kind,int ready,int network){
        if(!kind.matches("https|http|blob|missing|other")||ready<0||ready>4||network<0||network>3)return;
        state="fonte "+kind+" · readyState "+ready+" · networkState "+network;
    }
    synchronized String summary(String source){
        Integer status=http.get(source);String text="WebView: "+state;
        if(status!=null)text+=" · fonte original HTTP "+status;
        for(String signal:signals)text+=" · "+signal;
        return text;
    }
    private void add(String signal){if(signals.size()<5||signals.contains(signal))signals.add(signal);}
}
