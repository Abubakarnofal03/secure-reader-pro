import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

export const useAdminFCM = () => {
  const { profile, user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const hasAttempted = useRef(false);

  useEffect(() => {
    // Only register FCM for admins on native platforms
    const isAdmin = profile?.role === 'admin';
    if (!isAdmin || !user) return;
    
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) {
      console.log('FCM registration skipped: not a native platform');
      return;
    }

    // Prevent multiple registration attempts
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    const registerPushNotifications = async () => {
      try {
        // Check if PushNotifications plugin is available
        const isAvailable = Capacitor.isPluginAvailable('PushNotifications');
        if (!isAvailable) {
          console.log('PushNotifications plugin not available');
          setError('Push notifications not available');
          return;
        }

        // Dynamically import to prevent crashes if plugin not configured
        const { PushNotifications } = await import('@capacitor/push-notifications');
        
        // Check current permission status first
        const permissionStatus = await PushNotifications.checkPermissions();
        
        // If already denied, don't prompt again
        if (permissionStatus.receive === 'denied') {
          console.log('Push notification permission previously denied');
          setError('Permission denied');
          return;
        }

        // Request permission
        const permissionResult = await PushNotifications.requestPermissions();
        
        if (permissionResult.receive !== 'granted') {
          console.log('Push notification permission not granted');
          setError('Permission denied');
          return;
        }

        setIsSupported(true);

        // Set up listeners BEFORE calling register()
        await PushNotifications.addListener('registration', async (token) => {
          console.log('FCM Token received:', token.value);
          
          // Store token in database
          try {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ fcm_token: token.value })
              .eq('id', user.id);
            
            if (updateError) {
              console.error('Failed to store FCM token:', updateError);
              setError('Failed to store token');
            } else {
              console.log('FCM token stored successfully');
              setIsRegistered(true);
            }
          } catch (dbError) {
            console.error('Database error storing FCM token:', dbError);
          }
        });

        await PushNotifications.addListener('registrationError', (err) => {
          console.error('FCM registration error:', err);
          setError(err.error || 'Registration failed');
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification action performed:', notification);
          if (notification.notification.data?.type === 'purchase_request') {
            window.location.href = '/admin?tab=approvals';
          }
        });

        // Now register with APNs/FCM
        await PushNotifications.register();
        
      } catch (err) {
        // Catch any errors to prevent app crash
        console.error('FCM registration failed:', err);
        setError(err instanceof Error ? err.message : 'Registration failed');
        // Don't crash the app - just log and continue
      }
    };

    // Delay registration slightly to ensure app is fully loaded
    const timeoutId = setTimeout(() => {
      registerPushNotifications();
    }, 1000);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      // Only remove listeners if plugin was loaded
      if (isSupported) {
        import('@capacitor/push-notifications').then(({ PushNotifications }) => {
          PushNotifications.removeAllListeners();
        }).catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, [profile?.role, user, isSupported]);

  return { isRegistered, error, isSupported };
};
