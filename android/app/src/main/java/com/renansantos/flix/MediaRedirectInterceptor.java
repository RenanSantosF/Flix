package com.renansantos.flix;

import java.io.IOException;
import java.util.HashSet;
import okhttp3.HttpUrl;
import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

/** Follows only real Location responses, with validation before every connection. */
final class MediaRedirectInterceptor implements Interceptor {
    static final int MAX_REDIRECTS=10;
    static final class Failure extends IOException {
        Failure(String reason) {super(reason);}
    }
    @Override public Response intercept(Chain chain) throws IOException {
        Request request=chain.request();HashSet<String> visited=new HashSet<>();
        for(int redirects=0;;redirects++) {
            if(!MediaUrlPolicy.allowedNetwork(request.url().toString()))throw new Failure("destino de mídia não permitido");
            if(!visited.add(request.url().toString()))throw new Failure("ciclo de redirecionamentos");
            Response response=chain.proceed(request);int code=response.code();
            if(code!=301&&code!=302&&code!=303&&code!=307&&code!=308)return response;
            String location=response.header("Location");HttpUrl target=location==null?null:response.request().url().resolve(location);
            response.close();
            if(location==null||location.trim().isEmpty())throw new Failure("HTTP "+code+" sem cabeçalho Location");
            if(target==null||!MediaUrlPolicy.allowedNetwork(target.toString()))throw new Failure("HTTP "+code+" com destino de mídia não permitido");
            if(redirects>=MAX_REDIRECTS)throw new Failure("limite de redirecionamentos atingido");
            if(!"GET".equals(request.method())&&!"HEAD".equals(request.method()))throw new Failure("método de mídia não permitido no redirecionamento");
            // The cookie jar and per-destination context recompute credentials and
            // headers. Do not copy a previous hop's Cookie/Authorization headers.
            request=request.newBuilder().url(target).removeHeader("Cookie").removeHeader("Authorization")
                .removeHeader("Referer").removeHeader("Origin").build();
        }
    }
}
