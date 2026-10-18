package com.renansantos.flix;
import org.junit.Test;
import static org.junit.Assert.*;
public class BrowserDiagnosticsTest {
    @Test public void consoleKeepsOnlyCategoriesAndNeverRawPathsQueriesOrCookies(){
        BrowserDiagnostics d=new BrowserDiagnostics();
        d.console("Mixed Content: blocked http://cdn.example/private?token=secret Cookie=session");
        d.console("Uncaught TypeError: https://private.example/secret");
        String s=d.summary("");assertTrue(s.contains("conteúdo HTTP bloqueado"));assertTrue(s.contains("erro JavaScript"));assertTrue(s.contains("cdn.example"));
        for(String privateText:new String[]{"private.example","/private","token","Cookie","secret"})assertFalse(s.contains(privateText));
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
        assertTrue(d.summary("").length()<600);
    }
    @Test public void identifiesFailingHostsDestinationAndOriginalVideoWithoutDisplayingTokens(){
        BrowserDiagnostics d=new BrowserDiagnostics();String url="https://media.example/opaque?token=secret";
        d.source(url+"#play","https://player.example/");d.http(url,429,"video","text/html");
        d.network(-6,"https://ads.example/request?key=secret","script","net::ERR_CONNECTION_REFUSED https://secret.example/");
        String s=d.summary("");assertTrue(s.contains("fonte atual HTTP 429"));assertTrue(s.contains("media.example"));assertTrue(s.contains("mídia/HTML"));assertTrue(s.contains("ERR_CONNECTION_REFUSED"));assertTrue(s.contains("ads.example"));
        assertFalse(s.contains("token"));assertFalse(s.contains("secret"));assertFalse(s.contains("opaque"));
    }
    @Test public void javascriptDetailsKeepOnlySafeSymbolsAndKnownErrorTemplates(){
        assertEquals("TypeError: null.postMessage",BrowserDiagnostics.jsError("Uncaught TypeError: Cannot read properties of null (reading 'postMessage') https://secret.example/?token=hidden"));
        assertEquals("TypeError: null.closed",BrowserDiagnostics.jsError("Uncaught TypeError: Cannot read property 'closed' of null"));
        assertEquals("ReferenceError: adPlayer não definido",BrowserDiagnostics.jsError("ReferenceError: adPlayer is not defined"));
        assertEquals("TypeError: player.play não é função",BrowserDiagnostics.jsError("TypeError: player.play is not a function"));
        assertEquals("SyntaxError: resposta HTML",BrowserDiagnostics.jsError("SyntaxError: Unexpected token '<'"));
        assertEquals("TypeError",BrowserDiagnostics.jsError("TypeError: https://private.example/secretPath?token=hidden is not a function"));
        BrowserDiagnostics d=new BrowserDiagnostics();d.console("TypeError: Cannot read properties of null (reading 'closed')","https://cdn.example/script.js?token=hidden",17,true);
        String s=d.summary("");assertTrue(s.contains("null.closed"));assertTrue(s.contains("cdn.example:17"));assertFalse(s.contains("script.js"));assertFalse(s.contains("hidden"));
    }
    @Test public void aBrowserRetryClearsOnlyTheStaleSourceStatus(){
        BrowserDiagnostics d=new BrowserDiagnostics();String source="https://cdn.example/movie";
        d.source(source,"https://player.example");d.http(source,429);d.retry(source);
        assertFalse(d.summary("").contains("fonte atual HTTP"));
        d.http(source,429);assertTrue(d.summary("").contains("fonte atual HTTP 429"));
    }

    @Test public void expectedCloudflareProbesDoNotConsumeBlockingErrorSlots(){
        BrowserDiagnostics d=new BrowserDiagnostics();
        d.http("https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/pat/private?token=secret",401);
        d.network(-2,"https://brunhild.challenges.cloudflare.com/secret","","net::ERR_NAME_NOT_RESOLVED");
        d.http("https://video.example/source?token=secret",403,"video","application/json");
        String s=d.summary("");assertTrue(s.contains("HTTP 403 · video.example"));assertTrue(s.contains("auxiliares:"));assertTrue(s.contains("PAT indisponível"));assertTrue(s.contains("teste DNS auxiliar"));
        assertFalse(s.contains("HTTP 401"));assertFalse(s.contains("rede -2"));assertFalse(s.contains("secret"));
        d.clear();assertFalse(d.summary("").contains("auxiliares:"));
    }
    @Test public void realChallengeEndpointFailuresAndOther401sRemainVisible(){
        BrowserDiagnostics d=new BrowserDiagnostics();
        d.http("https://challenges.cloudflare.com/not-a-pat",401);
        d.http("https://media.example/cdn-cgi/challenge-platform/h/g/pat/private",401);
        d.network(-2,"https://challenges.cloudflare.com/widget","script","ERR_NAME_NOT_RESOLVED");
        d.network(-6,"https://brunhild.challenges.cloudflare.com/widget","script","ERR_CONNECTION_REFUSED");
        String s=d.summary("");assertTrue(s.contains("HTTP 401 · challenges.cloudflare.com"));assertTrue(s.contains("HTTP 401 · media.example"));assertTrue(s.contains("rede -2"));assertTrue(s.contains("ERR_CONNECTION_REFUSED"));
    }
    @Test public void mixedContentAutoupgradesAreNotReportedAsBlocksAndTargetsStaySanitized(){
        BrowserDiagnostics d=new BrowserDiagnostics();
        d.console("Mixed Content: The page requested an insecure video 'http://cdn.example/private?token=secret'. This request was automatically upgraded to HTTPS.");
        assertFalse(d.summary("").contains("conteúdo HTTP bloqueado"));assertTrue(d.summary("").contains("HTTP atualizado para HTTPS · mídia · cdn.example"));
        d.console("Mixed Content: requested an insecure script 'http://ads.example/private?token=secret'. This request has been blocked.");
        String s=d.summary("");assertTrue(s.contains("conteúdo HTTP bloqueado · script · ads.example"));assertFalse(s.contains("secret"));assertFalse(s.contains("/private"));
    }
    @Test public void cspReportsDirectiveAndHostButReportOnlyDoesNotClaimBlocking(){
        BrowserDiagnostics d=new BrowserDiagnostics();
        d.console("[Report-Only] Refused to load 'https://observe.example/private?token=secret' because it violates Content Security Policy directive: script-src");
        assertFalse(d.summary("").contains("CSP bloqueou"));
        d.console("Refused to connect to 'https://media.example/private?token=secret' because it violates Content Security Policy directive: connect-src");
        String s=d.summary("");assertTrue(s.contains("política CSP bloqueou recurso · connect-src · media.example"));assertFalse(s.contains("secret"));assertFalse(s.contains("/private"));
    }

}
