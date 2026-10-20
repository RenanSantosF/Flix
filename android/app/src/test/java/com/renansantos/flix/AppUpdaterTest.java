package com.renansantos.flix;
import org.junit.Test;
import static org.junit.Assert.*;
public class AppUpdaterTest {
    @Test public void progressIsBoundedAndSafeWithoutLength() {
        assertEquals(0, AppUpdater.percent(10, 0));
        assertEquals(50, AppUpdater.percent(50, 100));
        assertEquals(100, AppUpdater.percent(150, 100));
        assertTrue(AppUpdater.APK_URL.startsWith("https://github.com/RenanSantosF/Flix/releases/"));
    }
}
