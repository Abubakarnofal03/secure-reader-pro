import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Safely initialize push notifications.
 * Uses dynamic imports and defensive checks to prevent native crashes
 * when Firebase/FCM is not properly configured (e.g. missing google-services.json).
 */
export const initializePushNotifications = async () => {
  // Only available on mobile platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('[Push] Not available on web');
    return;
  }

  // Check if the plugin is even available before trying to import
  if (!Capacitor.isPluginAvailable('PushNotifications')) {
    console.log('[Push] PushNotifications plugin not available');
    return;
  }

  try {
    // Dynamic import to avoid loading the module at bundle time
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Create notification channel for Android 8.0+ BEFORE requesting permissions
    if (Capacitor.getPlatform() === 'android') {
      try {
        await PushNotifications.createChannel({
          id: 'default_channel',
          name: 'Default Notifications',
          description: 'General notifications for new content and updates',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        });
        console.log('[Push] ✅ Notification channel created');
      } catch (channelError) {
        console.warn('[Push] Channel creation failed (non-fatal):', channelError);
      }
    }

    // Set up ALL listeners BEFORE requesting permissions or registering.
    // This ensures we catch any events that fire immediately after register().
    await PushNotifications.addListener('registration', (token) => {
      console.log('[Push] ✅ Token received:', token.value?.substring(0, 20) + '...');
      sendTokenToServer(token.value);
    });

    await PushNotifications.addListener('registrationError', (error) => {
      // This fires when Firebase fails to get a token — NOT a crash, just a failed registration.
      console.error('[Push] ❌ Registration failed:', JSON.stringify(error));
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notification received (foreground):', JSON.stringify(notification));
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[Push] Notification tapped:', JSON.stringify(notification));
      handleNotificationNavigation(notification.notification?.data);
    });

    // Now check/request permissions
    let permStatus = await PushNotifications.checkPermissions();
    console.log('[Push] Current permission:', permStatus.receive);

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      // This will show the system "Allow notifications?" dialog
      permStatus = await PushNotifications.requestPermissions();
      console.log('[Push] Permission result:', permStatus.receive);
    }

    if (permStatus.receive !== 'granted') {
      console.log('[Push] Permission not granted, skipping registration');
      return;
    }

    // Register with Firebase to get a token.
    // If google-services.json is missing, the 'registrationError' listener will fire
    // instead of crashing the app (because we set up listeners first).
    console.log('[Push] Registering...');
    await PushNotifications.register();
    console.log('[Push] register() called, waiting for token callback...');

  } catch (err) {
    // Catch any remaining errors — import failure, plugin not linked, etc.
    console.error('[Push] ❌ Initialization failed (non-fatal):', err);
  }
};

// Send token to backend
const sendTokenToServer = async (token: string) => {
  try {
    if (!navigator.onLine) {
      console.log('[Push] Offline, skipping token save');
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn('[Push] Cannot save token: user not authenticated');
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Push] Failed to save token:', updateError);
    } else {
      console.log('[Push] ✅ Token saved for user:', user.id);
    }
  } catch (error) {
    console.error('[Push] Token save error:', error);
  }
};

// Handle navigation when notification is tapped
const handleNotificationNavigation = (data: any) => {
  if (!data) {
    window.location.href = '/library';
    return;
  }

  console.log('[Push] Handling notification tap:', data);

  switch (data.type) {
    case 'purchase_request':
      window.location.href = '/admin?tab=approvals';
      break;
    case 'purchase_approved':
      window.location.href = data.content_id ? `/reader/${data.content_id}` : '/library';
      break;
    case 'new_content':
      window.location.href = data.content_id ? `/library?highlight=${data.content_id}` : '/library';
      break;
    case 'new_post':
      window.location.href = '/library?tab=highlights';
      break;
    default:
      window.location.href = '/library';
  }
};

// Clean up listeners
export const cleanupPushNotifications = async () => {
  try {
    if (!Capacitor.isNativePlatform()) return;
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners();
  } catch (err) {
    console.error('[Push] Cleanup failed:', err);
  }
};

// Get current notification status
export const getNotificationStatus = async () => {
  try {
    if (!Capacitor.isNativePlatform()) return null;
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return await PushNotifications.checkPermissions();
  } catch {
    return null;
  }
};

// Remove all delivered notifications
export const removeAllNotifications = async () => {
  try {
    if (!Capacitor.isNativePlatform()) return;
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllDeliveredNotifications();
  } catch {
    // silently ignore
  }
};
