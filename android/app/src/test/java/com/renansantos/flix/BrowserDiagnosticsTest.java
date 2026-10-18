package com.renansantos.flix;
import org.junit.Test;
import static org.junit.Assert.*;
public class BrowserDiagnosticsTest {
    @Test public void consoleKeepsOnlyCategoriesAndNeverRawPathsQueriesOrCookies(){
        BrowserDiagnostics d=new BrowserDiagnostics();
        d.console("Mixed Content: blocked http://cdn.example/private?token=secret Cookie=session");
        d.console("Uncaught TypeError: https://private.example/secret");
        String s=d.summary("");assertTrue(s.contains("conteúdo HTTP bloqueado"));assertTrue(s.contains("erro JavaScript"));
        for(String privateText:new String[]{"cdn.example","private.example","token","Cookie","secret"})assertFalse(s.contains(privateText));
    }
    @Test public void originalSourceHttpStatusIsMatchedLocallyAndClearedWithTheContext(){
        BrowserDiagnostics d=new BrowserDiagnostics();String url="https://cdn.example/media?token=secret";
        d.http(url,429);d.state("https",0,2);assertTrue(d.summary(url).contains("fonte original HTTP 429"));
        assertFalse(d.summary("https://other.example/media").contains("fonte original HTTP"));assertFalse(d.summary(url).contains("secret"));
        d.clear();assertFalse(d.summary(url).contains("429"));assertFalse(d.summary(url).contains("networkState"));
    }
    @Test public void evidenceIsBoundedAndRejectsUnvalidatedStateAndNetworkCodes(){
        BrowserDiagnostics d=new BrowserDiagnostics();
        d.state("https://secret.example/?token=x",200,900);d.network(123456);assertFalse(d.summary("").contains("secret"));
        for(int i=400;i<500;i++)d.http("https://cdn.example/"+i,i);
        assertFalse(d.summary("https://cdn.example/400").contains("fonte original HTTP"));assertTrue(d.summary("https://cdn.example/499").contains("fonte original HTTP 499"));
        assertTrue(d.summary("").length()<250);
    }
}
