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
    @org.junit.Test public void playbackContextsAreRestrictedToTheirOwnScreens() {
        org.junit.Assert.assertTrue(NavigationPolicy.matchesPlaybackPath("live:channel-sportv", "/ao-vivo"));
        org.junit.Assert.assertTrue(NavigationPolicy.matchesPlaybackPath("live:event-final-2026", "/ao-vivo"));
        org.junit.Assert.assertFalse(NavigationPolicy.matchesPlaybackPath("live:channel-sportv", "/titulo/movie/603"));
        org.junit.Assert.assertFalse(NavigationPolicy.matchesPlaybackPath("movie:603", "/ao-vivo"));
        org.junit.Assert.assertFalse(NavigationPolicy.isPlaybackKey("live:https://outside.example"));
        org.junit.Assert.assertFalse(NavigationPolicy.isPlaybackKey("movie:abc"));
    }
    @Test public void providerDependenciesCanLoadWhileTopLevelAdsStayBlocked() {
        assertFalse(NavigationPolicy.blockNetworkRequest("https://asiafilm.org/player-bootstrap.js",false));
        assertTrue(NavigationPolicy.canLoadSubframe("https://asiafilm.org/embed"));
        assertTrue(NavigationPolicy.blockNetworkRequest("https://asiafilm.org/ad",true));
        assertTrue(NavigationPolicy.blockNetworkRequest("https://outside.example/ad",true));
        assertFalse(NavigationPolicy.blockNetworkRequest(NavigationPolicy.HOME,true));
    }
    @org.junit.Test public void comparisonReloadKeepsOnlyValidatedAppPlaybackTargets(){
        org.junit.Assert.assertEquals(NavigationPolicy.HOME+"titulo/movie/557?play=1&adTest=1",NavigationPolicy.comparisonUrl("movie:557",true));
        org.junit.Assert.assertEquals(NavigationPolicy.HOME+"titulo/tv/1396?play=1",NavigationPolicy.comparisonUrl("tv:1396",false));
        org.junit.Assert.assertEquals(NavigationPolicy.HOME+"ao-vivo?tipo=channel&id=sportv&adTest=1",NavigationPolicy.comparisonUrl("live:channel-sportv",true));
        org.junit.Assert.assertEquals(NavigationPolicy.HOME,NavigationPolicy.comparisonUrl("https://other.example",true));
    }

}
