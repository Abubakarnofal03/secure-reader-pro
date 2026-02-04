import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const initializePushNotifications = async () => {
  // Only available on mobile platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications not available on web');
    return;
  }

  // CRITICAL: Create notification channel FIRST (Android 8.0+)
  // Without this, notifications won't be delivered on Android 8.0+
  if (Capacitor.getPlatform() === 'android') {
    try {
      await PushNotifications.createChannel({
        id: 'default_channel',
        name: 'Default Notifications',
        description: 'General notifications for new content and updates',
        importance: 5, // Max importance (shows popup)
        visibility: 1, // Public (shows on lock screen)
        sound: 'default',
        vibration: true,
      });
      console.log('✅ Notification channel created: default_channel');
    } catch (channelError) {
      console.error('Failed to create notification channel:', channelError);
    }
  }

  // Request permission
  const permissionStatus = await PushNotifications.requestPermissions();

  if (permissionStatus.receive === 'granted') {
    // Register with Apple / Google to receive push notifications
    await PushNotifications.register();
  } else {
    console.log('Push notification permission denied');
    return;
  }

  // On success, register device token
  await PushNotifications.addListener('registration', (token: Token) => {
    console.log('Push registration success, token: ' + token.value);
    sendTokenToServer(token.value);
  });

  // Error during registration
  await PushNotifications.addListener('registrationError', (error: any) => {
    console.error('Error on registration: ' + JSON.stringify(error));
  });

  // Notification received while app is in foreground
  await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('Push notification received: ' + JSON.stringify(notification));
    // You can show a custom in-app notification here
  });

  // Notification tapped (app opened from notification)
  await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
    console.log('Push notification action performed', JSON.stringify(notification));
    // Handle navigation based on notification data
    handleNotificationNavigation(notification.notification.data);
  });
};

// Send token to your backend
const sendTokenToServer = async (token: string) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Cannot save token: User not authenticated');
      return;
    }

    // Save token to profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error saving FCM token to database:', updateError);
    } else {
      console.log('FCM token saved successfully for user:', user.id);
    }

  } catch (error) {
    console.error('Error sending token to server:', error);
  }
};

// Handle navigation when notification is tapped
const handleNotificationNavigation = (data: any) => {
  // Example: Navigate to specific screen based on notification data
  console.log('Notification data:', data);

  // TODO: Implement your navigation logic
  // Examples:
  // if (data.screen === 'meal') {
  //   window.location.href = `/meal/${data.mealId}`;
  // }
  // if (data.screen === 'stats') {
  //   window.location.href = '/stats';
  // }
};

// Clean up listeners when no longer needed
export const cleanupPushNotifications = async () => {
  await PushNotifications.removeAllListeners();
};

// Get current notification status
export const getNotificationStatus = async () => {
  const status = await PushNotifications.checkPermissions();
  return status;
};

// Remove all delivered notifications from notification center
export const removeAllNotifications = async () => {
  await PushNotifications.removeAllDeliveredNotifications();
};
