package com.renansantos.flix;

import java.net.URI;
import java.util.Locale;

final class NavigationPolicy {
    static final String APP_HOST = "flix-ebon-ten.vercel.app";
    static final String HOME = "https://" + APP_HOST + "/";
    private static final String[] AD_HOSTS = {"asiafilm.org", "budgetezy.org", "spartanamicus.com", "linkonclick.com"};

    static boolean isPlaybackKey(String key) {
        return key != null && (key.matches("(movie|tv):[0-9]{1,12}") || key.matches("live:(channel|event)-[a-z0-9_-]{1,100}"));
    }

    static boolean matchesPlaybackPath(String key, String path) {
        return isPlaybackKey(key) && (key.startsWith("live:") ? "/ao-vivo".equals(path) : ("/titulo/" + key.replace(':', '/')).equals(path));
    }

    static boolean isAppUrl(String value) {
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && APP_HOST.equalsIgnoreCase(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (RuntimeException e) { return false; }
    }

    static boolean isDownloadUrl(String value) {
        try {
            URI uri = URI.create(value);
            return isAppUrl(value) && "/baixar".equals(uri.getPath());
        } catch (RuntimeException e) { return false; }
    }

    static boolean isAdUrl(String value) {
        try {
            String host = URI.create(value).getHost();
            if (host == null) return false;
            host = host.toLowerCase(Locale.ROOT);
            for (String ad : AD_HOSTS) if (host.equals(ad) || host.endsWith("." + ad)) return true;
        } catch (RuntimeException ignored) { }
        return false;
    }

    static boolean blockNetworkRequest(String value, boolean mainFrame) {
        // Popup windows have their own offline WebView. A host-wide network deny
        // also blocked scripts/redirect chains needed by legitimate video sources.
        return mainFrame && !isAppUrl(value);
    }

    static boolean canLoadSubframe(String value) {
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            return "https".equalsIgnoreCase(scheme)
                || "about:blank".equals(value) || "about:srcdoc".equals(value) || "blob".equalsIgnoreCase(scheme) || "data".equalsIgnoreCase(scheme);
        } catch (RuntimeException e) { return false; }
    }
}
