package com.renansantos.flix;

final class CastRequestPolicy {
    static boolean providerUnsupported(String url,String message){
        if(!"Transmissão indisponível neste navegador ou dispositivo.".equals(message))return false;
        try{java.net.URI uri=java.net.URI.create(url);return "https".equals(uri.getScheme())&&"superflixapi.fun".equals(uri.getHost());}catch(RuntimeException invalid){return false;}
    }
}
