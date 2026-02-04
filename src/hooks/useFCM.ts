import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to register all authenticated users for FCM push notifications.
 * Works on native platforms only.
 */
export const useFCM = () => {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const hasAttempted = useRef(false);

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    
    console.log('[useFCM] Init check:', { isNative, hasUser: !!user, hasAttempted: hasAttempted.current });
    
    if (!user) {
      console.log('[useFCM] Skipped: no user');
      return;
    }
    
    if (!isNative) {
      console.log('[useFCM] Skipped: not native platform');
      return;
    }

    if (hasAttempted.current) {
      console.log('[useFCM] Skipped: already attempted registration');
      return;
    }
    
    hasAttempted.current = true;
    console.log('[useFCM] Starting FCM registration for user:', user.id);

    const registerPushNotifications = async () => {
      try {
        const isAvailable = Capacitor.isPluginAvailable('PushNotifications');
        console.log('[useFCM] Plugin available:', isAvailable);
        
        if (!isAvailable) {
          setError('Push notifications plugin not available');
          return;
        }

        const module = await import('@capacitor/push-notifications');
        const PushNotifications = module.PushNotifications;
        console.log('[useFCM] PushNotifications module loaded');

        // Check permissions
        const permissionStatus = await PushNotifications.checkPermissions();
        console.log('[useFCM] Current permission status:', permissionStatus.receive);
        
        if (permissionStatus.receive === 'denied') {
          console.warn('[useFCM] Permission previously denied');
          setError('Permission denied');
          return;
        }

        // Request permission
        console.log('[useFCM] Requesting permissions...');
        const permissionResult = await PushNotifications.requestPermissions();
        console.log('[useFCM] Permission result:', permissionResult.receive);
        
        if (permissionResult.receive !== 'granted') {
          console.warn('[useFCM] Permission not granted');
          setError('Permission denied');
          return;
        }

        setIsSupported(true);
        console.log('[useFCM] Permissions granted, setting up listeners...');

        // Registration listener
        await PushNotifications.addListener('registration', async (token: { value: string }) => {
          console.log('[useFCM] ✅ FCM Token received:', token.value.substring(0, 20) + '...');
          
          try {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ fcm_token: token.value })
              .eq('id', user.id);
            
            if (updateError) {
              console.error('[useFCM] ❌ Failed to store token:', updateError);
              setError('Failed to store token');
            } else {
              console.log('[useFCM] ✅ Token stored successfully for user:', user.id);
              setIsRegistered(true);
            }
          } catch (dbError) {
            console.error('[useFCM] ❌ Database error:', dbError);
            setError('Database error');
          }
        });

        // Error listener
        await PushNotifications.addListener('registrationError', (err: { error: string }) => {
          console.error('[useFCM] ❌ Registration error:', err);
          setError(err.error || 'Registration failed');
        });

        // Notification received (foreground)
        await PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
          console.log('[useFCM] 🔔 Push notification received (foreground):', notification);
        });

        // Notification tapped - handle deep linking
        await PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
          console.log('[useFCM] 🔔 Push notification action performed:', notification);
          
          const data = notification.notification?.data;
          if (!data) {
            console.log('[useFCM] No data in notification, defaulting to library');
            window.location.href = '/library';
            return;
          }

          const notificationType = data.type;
          console.log('[useFCM] Notification type:', notificationType);

          switch (notificationType) {
            case 'purchase_request':
              // Admin: go to approvals
              window.location.href = '/admin?tab=approvals';
              break;

            case 'purchase_approved':
              // User: go to reader for the approved content
              if (data.content_id) {
                window.location.href = `/reader/${data.content_id}`;
              } else {
                window.location.href = '/library';
              }
              break;

            case 'new_content':
              // New publication: go to library
              if (data.content_id) {
                window.location.href = `/library?highlight=${data.content_id}`;
              } else {
                window.location.href = '/library';
              }
              break;

            case 'new_post':
              // New blog/news/highlight: go to library
              window.location.href = '/library?tab=highlights';
              break;

            default:
              window.location.href = '/library';
          }
        });

        console.log('[useFCM] Calling register()...');
        await PushNotifications.register();
        console.log('[useFCM] register() called successfully, waiting for token...');
        
      } catch (err) {
        console.error('[useFCM] ❌ Fatal error:', err);
        setError(err instanceof Error ? err.message : 'Registration failed');
      }
    };

    registerPushNotifications();
  }, [user]);

  return { isRegistered, error, isSupported };
};
