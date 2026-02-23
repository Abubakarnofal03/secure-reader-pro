package com.mycalorics.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that keeps the app alive during background downloads
 * and shows a persistent notification with download progress.
 */
public class DownloadForegroundService extends Service {

    public static final String ACTION_START = "com.mycalorics.app.action.START_DOWNLOAD";
    public static final String ACTION_STOP = "com.mycalorics.app.action.STOP_DOWNLOAD";
    public static final String ACTION_UPDATE_PROGRESS = "com.mycalorics.app.action.UPDATE_PROGRESS";

    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_TOTAL_SEGMENTS = "extra_total_segments";
    public static final String EXTRA_CURRENT_SEGMENT = "extra_current_segment";
    public static final String EXTRA_PROGRESS = "extra_progress";
    public static final String EXTRA_SUCCESS = "extra_success";

    private static final String CHANNEL_ID = "download_channel";
    private static final int NOTIFICATION_ID = 9001;
    private static final int COMPLETION_NOTIFICATION_ID = 9002;

    private NotificationManager notificationManager;
    private String currentTitle = "Publication";

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = getSystemService(NotificationManager.class);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();

        if (ACTION_START.equals(action)) {
            currentTitle = intent.getStringExtra(EXTRA_TITLE);
            if (currentTitle == null) currentTitle = "Publication";
            int totalSegments = intent.getIntExtra(EXTRA_TOTAL_SEGMENTS, 1);

            Notification notification = buildProgressNotification(currentTitle, 0, totalSegments, 0);
            startForeground(NOTIFICATION_ID, notification);

        } else if (ACTION_UPDATE_PROGRESS.equals(action)) {
            int currentSegment = intent.getIntExtra(EXTRA_CURRENT_SEGMENT, 0);
            int totalSegments = intent.getIntExtra(EXTRA_TOTAL_SEGMENTS, 1);
            int progress = intent.getIntExtra(EXTRA_PROGRESS, 0);

            Notification notification = buildProgressNotification(currentTitle, currentSegment, totalSegments, progress);
            notificationManager.notify(NOTIFICATION_ID, notification);

        } else if (ACTION_STOP.equals(action)) {
            boolean success = intent.getBooleanExtra(EXTRA_SUCCESS, true);
            String title = intent.getStringExtra(EXTRA_TITLE);
            if (title == null) title = currentTitle;

            // Show completion notification
            showCompletionNotification(title, success);

            // Stop the foreground service
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }

        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Downloads",
                    NotificationManager.IMPORTANCE_LOW  // Low importance = no sound, shows in tray
            );
            channel.setDescription("Download progress notifications");
            channel.setShowBadge(false);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private Notification buildProgressNotification(String title, int currentSegment, int totalSegments, int progress) {
        // Intent to open the app when notification is tapped
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String contentText;
        if (totalSegments > 1) {
            contentText = "Part " + currentSegment + "/" + totalSegments + " — " + progress + "%";
        } else {
            contentText = progress + "% complete";
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Downloading " + title)
                .setContentText(contentText)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setProgress(100, progress, progress == 0)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void showCompletionNotification(String title, boolean success) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String contentTitle = success ? "Download complete" : "Download failed";
        String contentText = success
                ? title + " is ready for offline reading"
                : title + " could not be downloaded";
        int icon = success
                ? android.R.drawable.stat_sys_download_done
                : android.R.drawable.stat_notify_error;

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(contentTitle)
                .setContentText(contentText)
                .setSmallIcon(icon)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build();

        notificationManager.notify(COMPLETION_NOTIFICATION_ID, notification);
    }
}
