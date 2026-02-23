package com.mycalorics.app;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeDownloader")
public class NativeDownloaderPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /**
     * Download a file from a URL and save it directly to the app's data directory.
     * Uses HttpURLConnection (same HTTP stack as Chrome on Android) for full bandwidth.
     *
     * Expected params:
     *   url: string        - The signed URL to download from
     *   filePath: string   - Relative path within app data dir (e.g. "offline-content/{id}/segment-0.pdf")
     */
    @PluginMethod()
    public void downloadFile(PluginCall call) {
        String url = call.getString("url");
        String filePath = call.getString("filePath");

        if (url == null || filePath == null) {
            call.reject("Missing required params: url, filePath");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection connection = null;
            InputStream inputStream = null;
            FileOutputStream outputStream = null;

            try {
                // Resolve the target file in the app's internal data directory
                File dataDir = getContext().getFilesDir();
                File targetFile = new File(dataDir, filePath);

                // Ensure parent directories exist
                File parentDir = targetFile.getParentFile();
                if (parentDir != null && !parentDir.exists()) {
                    parentDir.mkdirs();
                }

                // Open HTTP connection
                URL downloadUrl = new URL(url);
                connection = (HttpURLConnection) downloadUrl.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                // Request no buffering limits
                connection.setRequestProperty("Accept-Encoding", "identity");
                connection.connect();

                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    call.reject("HTTP error: " + responseCode + " " + connection.getResponseMessage());
                    return;
                }

                long totalBytes = connection.getContentLengthLong();
                inputStream = connection.getInputStream();
                outputStream = new FileOutputStream(targetFile);

                byte[] buffer = new byte[8192];
                long downloadedBytes = 0;
                int bytesRead;
                int lastReportedProgress = -1;

                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                    downloadedBytes += bytesRead;

                    // Report progress every 5% to avoid flooding the bridge
                    if (totalBytes > 0) {
                        int progress = (int) ((downloadedBytes * 100) / totalBytes);
                        if (progress != lastReportedProgress && progress % 5 == 0) {
                            lastReportedProgress = progress;
                            JSObject progressData = new JSObject();
                            progressData.put("progress", progress);
                            progressData.put("downloadedBytes", downloadedBytes);
                            progressData.put("totalBytes", totalBytes);
                            notifyListeners("downloadProgress", progressData);
                        }
                    }
                }

                outputStream.flush();

                JSObject result = new JSObject();
                result.put("path", targetFile.getAbsolutePath());
                result.put("size", downloadedBytes);
                call.resolve(result);

            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage(), e);
            } finally {
                try { if (outputStream != null) outputStream.close(); } catch (Exception ignored) {}
                try { if (inputStream != null) inputStream.close(); } catch (Exception ignored) {}
                if (connection != null) connection.disconnect();
            }
        });
    }

    /**
     * Start the foreground service to keep downloads alive in background.
     * Shows a persistent notification with download progress.
     *
     * Expected params:
     *   title: string      - The content title to show in notification
     *   totalSegments: int  - Total number of segments to download
     */
    @PluginMethod()
    public void startForegroundDownload(PluginCall call) {
        String title = call.getString("title", "Publication");
        int totalSegments = call.getInt("totalSegments", 1);

        Context context = getContext();
        Intent intent = new Intent(context, DownloadForegroundService.class);
        intent.setAction(DownloadForegroundService.ACTION_START);
        intent.putExtra(DownloadForegroundService.EXTRA_TITLE, title);
        intent.putExtra(DownloadForegroundService.EXTRA_TOTAL_SEGMENTS, totalSegments);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }

        call.resolve();
    }

    /**
     * Update the foreground notification progress.
     *
     * Expected params:
     *   currentSegment: int - Current segment being downloaded (1-based)
     *   totalSegments: int  - Total segments
     *   overallProgress: int - Overall percentage (0-100)
     */
    @PluginMethod()
    public void updateDownloadProgress(PluginCall call) {
        int currentSegment = call.getInt("currentSegment", 0);
        int totalSegments = call.getInt("totalSegments", 1);
        int overallProgress = call.getInt("overallProgress", 0);

        Context context = getContext();
        Intent intent = new Intent(context, DownloadForegroundService.class);
        intent.setAction(DownloadForegroundService.ACTION_UPDATE_PROGRESS);
        intent.putExtra(DownloadForegroundService.EXTRA_CURRENT_SEGMENT, currentSegment);
        intent.putExtra(DownloadForegroundService.EXTRA_TOTAL_SEGMENTS, totalSegments);
        intent.putExtra(DownloadForegroundService.EXTRA_PROGRESS, overallProgress);

        context.startService(intent);
        call.resolve();
    }

    /**
     * Stop the foreground service and show completion notification.
     *
     * Expected params:
     *   title: string  - Content title for the completion notification
     *   success: bool  - Whether the download succeeded
     */
    @PluginMethod()
    public void stopForegroundDownload(PluginCall call) {
        boolean success = call.getBoolean("success", true);
        String title = call.getString("title", "Publication");

        Context context = getContext();
        Intent intent = new Intent(context, DownloadForegroundService.class);
        intent.setAction(DownloadForegroundService.ACTION_STOP);
        intent.putExtra(DownloadForegroundService.EXTRA_TITLE, title);
        intent.putExtra(DownloadForegroundService.EXTRA_SUCCESS, success);

        context.startService(intent);
        call.resolve();
    }
}
