package com.renansantos.flix;
import org.junit.Test;
import static org.junit.Assert.*;
public class NavigationPolicyTest {
    @Test public void onlyExactAppOriginCanReplaceTheMainPage() {
        assertTrue(NavigationPolicy.isAppUrl(NavigationPolicy.HOME + "titulo/movie/603"));
        for (String bad : new String[]{"https://flix-ebon-ten.vercel.app.evil.test/", "https://evil.test/", "http://flix-ebon-ten.vercel.app/", "intent://ads", "file:///etc/passwd", "https://evil@flix-ebon-ten.vercel.app/", "https://flix-ebon-ten.vercel.app:444/"}) assertFalse(bad, NavigationPolicy.isAppUrl(bad));
    }
    @Test public void videoAndVerificationSubframesRemainPossible() {
        assertTrue(NavigationPolicy.canLoadSubframe("https://superflixapi.fun/filme/603"));
        assertTrue(NavigationPolicy.canLoadSubframe("https://challenges.cloudflare.com/widget"));
        assertTrue(NavigationPolicy.canLoadSubframe("blob:https://superflixapi.fun/test"));
        assertFalse(NavigationPolicy.canLoadSubframe("intent://external-app"));
        assertFalse(NavigationPolicy.canLoadSubframe("market://details?id=ad"));
        assertFalse(NavigationPolicy.canLoadSubframe("http://insecure.test/player"));
    }
    @Test public void blocksObservedAdvertisingHostsAndTheirSubdomains() {
        assertTrue(NavigationPolicy.isAdUrl("https://asiafilm.org/ad"));
        assertTrue(NavigationPolicy.isAdUrl("https://ka.spartanamicus.com/ad"));
        assertFalse(NavigationPolicy.isAdUrl("https://spartanamicus.com.evil.test/"));
        assertFalse(NavigationPolicy.isAdUrl("https://superflixapi.fun/filme/603"));
    }
}
