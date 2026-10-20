package com.renansantos.flix;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Downloads the latest release APK inside the app and hands it to the system installer. */
final class AppUpdater {
    interface Listener { void state(String state, int percent); }
    // Only the project's own release asset; Android rejects it unless it carries the same signature.
    static final String APK_URL = "https://github.com/RenanSantosF/Flix/releases/latest/download/Flix.apk";
    private static final long MAX_BYTES = 150L * 1024 * 1024;
    private final Activity activity;
    private final Listener listener;
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean running, awaitingPermission;

    AppUpdater(Activity activity, Listener listener) { this.activity = activity; this.listener = listener; }

    void start() {
        if (running) return;
        if (!activity.getPackageManager().canRequestPackageInstalls()) {
            // First update only: the user allows Flix to install its own updates, then returns.
            awaitingPermission = true;
            listener.state("permission", 0);
            try { activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))); }
            catch (Exception e) { awaitingPermission = false; listener.state("error", 0); }
            return;
        }
        running = true;
        listener.state("downloading", 0);
        new Thread(this::download, "flix-update").start();
    }

    /** Called from onResume: continue once the install permission was granted. */
    void resumed() {
        if (!awaitingPermission) return;
        awaitingPermission = false;
        if (activity.getPackageManager().canRequestPackageInstalls()) start(); else listener.state("denied", 0);
    }

    static int percent(long done, long total) { return total > 0 ? (int) Math.max(0, Math.min(100, done * 100 / total)) : 0; }

    private void download() {
        File dir = new File(activity.getCacheDir(), "updates"), target = new File(dir, "Flix.apk"), part = new File(dir, "Flix.apk.part");
        HttpURLConnection connection = null;
        try {
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("cache");
            connection = (HttpURLConnection) new URL(APK_URL).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
            if (connection.getResponseCode() != 200 || !"https".equals(connection.getURL().getProtocol())) throw new IllegalStateException("http");
            long total = connection.getContentLengthLong(), done = 0; int last = -1;
            if (total > MAX_BYTES) throw new IllegalStateException("size");
            try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(part)) {
                byte[] buffer = new byte[64 * 1024]; int count;
                while ((count = in.read(buffer)) != -1) {
                    done += count; if (done > MAX_BYTES) throw new IllegalStateException("size");
                    out.write(buffer, 0, count);
                    int p = percent(done, total);
                    if (p != last) { last = p; final int value = p; main.post(() -> listener.state("downloading", value)); }
                }
            }
            if (target.exists() && !target.delete()) throw new IllegalStateException("replace");
            if (!part.renameTo(target)) throw new IllegalStateException("rename");
            main.post(() -> install(target));
        } catch (Exception e) {
            //noinspection ResultOfMethodCallIgnored
            part.delete();
            main.post(() -> { running = false; listener.state("error", 0); });
        } finally { if (connection != null) connection.disconnect(); }
    }

    private void install(File apk) {
        running = false;
        try {
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".updates", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            listener.state("installing", 100);
            activity.startActivity(intent);
        } catch (Exception e) { listener.state("error", 0); }
    }
}
