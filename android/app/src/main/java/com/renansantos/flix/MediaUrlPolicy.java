package com.renansantos.flix;

import java.net.URI;
import java.net.InetAddress;
import java.util.Locale;

/** Rules for the media URL already assigned to a failed HTML video. */
final class MediaUrlPolicy {
    static boolean allowed(String value) {
        if (value == null || value.length() > 4096) return false;
        try {
            URI uri = URI.create(value); String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getUserInfo() != null
                || (uri.getPort() != -1 && uri.getPort() != 443) || NavigationPolicy.isAdUrl(value)) return false;
            host = host.toLowerCase(Locale.ROOT);
            if (!host.contains(".") || host.endsWith(".") || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
            // Numeric IP hosts are unnecessary for provider media and ambiguous across URL parsers.
            return !host.matches("[0-9.]+") && !host.contains(":") && host.matches("[a-z0-9.-]+");
        } catch (RuntimeException ignored) { return false; }
    }
    // Used only by Media3 for Location targets and playlist resources. The first
    // source passed from JavaScript remains restricted by allowed() to HTTPS/443.
    static boolean allowedNetwork(String value) {
        if(value==null||value.length()>4096)return false;
        try {
            URI uri=URI.create(value);String host=uri.getHost(),scheme=uri.getScheme();int port=uri.getPort();
            if((!"https".equalsIgnoreCase(scheme)&&!"http".equalsIgnoreCase(scheme))||host==null||uri.getUserInfo()!=null||port==0||port>65535)return false;
            host=host.toLowerCase(Locale.ROOT);
            return host.contains(".")&&!host.endsWith(".")&&!host.endsWith(".localhost")&&!host.endsWith(".local")&&!host.endsWith(".internal")
                &&!host.matches("[0-9.]+")&&!host.contains(":")&&host.matches("[a-z0-9.-]+");
        } catch(RuntimeException ignored) {return false;}
    }
    static boolean publicAddress(InetAddress address) {
        byte[] bytes = address.getAddress();
        return !address.isAnyLocalAddress() && !address.isLoopbackAddress() && !address.isLinkLocalAddress()
            && !address.isSiteLocalAddress() && !address.isMulticastAddress()
            && !(bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc);
    }
    static String origin(String value) {
        try { URI uri = URI.create(value); return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null ? "https://" + uri.getHost() + "/" : ""; }
        catch (RuntimeException ignored) { return ""; }
    }
}
