package com.renansantos.flix;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

/** Reproduces the failed video's declared browser request context, locally only. */
final class MediaRequestContext {
    private final String page, origin, policy, cors;
    MediaRequestContext(String frame, String reportedOrigin, String referrerPolicy, String corsMode) {
        origin=origin(reportedOrigin);
        String safe=frame!=null&&!origin.isEmpty()&&origin(frame).equals(origin)&&frame.length()<=4096?withoutFragment(frame):origin+"/";
        page=safe; policy=referrerPolicy==null?"":referrerPolicy;
        cors="anonymous".equals(corsMode)||"use-credentials".equals(corsMode)?corsMode:"none";
    }
    Map<String,String> headers(String target) {
        Map<String,String> headers=new LinkedHashMap<>();
        if(origin.isEmpty())return headers;
        boolean same=origin.equals(origin(target));String referer;
        switch(policy) {
            case "no-referrer": referer="";break;
            case "same-origin": referer=same?page:"";break;
            case "origin":case "strict-origin": referer=origin+"/";break;
            case "unsafe-url":case "no-referrer-when-downgrade": referer=page;break;
            default: referer=same?page:origin+"/";
        }
        if(!referer.isEmpty())headers.put("Referer",referer);
        if(!"none".equals(cors))headers.put("Origin",origin);
        return headers;
    }
    boolean cookiesAllowed(String target) {return !"anonymous".equals(cors)||origin.equals(origin(target));}
    private static String withoutFragment(String value) {int at=value.indexOf('#');return at<0?value:value.substring(0,at);}
    private static String origin(String value) {
        try {
            URI uri=URI.create(value);
            if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)return "";
            int port=uri.getPort();if(port< -1||port==0||port>65535)return "";
            return "https://"+uri.getHost().toLowerCase(java.util.Locale.ROOT)+(port==-1||port==443?"":":"+port);
        } catch(RuntimeException ignored) {return "";}
    }
}
