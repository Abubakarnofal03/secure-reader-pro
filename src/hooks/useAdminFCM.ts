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
    const isAdmin = profile?.role === 'admin';
    const isNative = Capacitor.isNativePlatform();
    
    console.log('[useAdminFCM] Init check:', { isAdmin, isNative, hasUser: !!user, hasAttempted: hasAttempted.current });
    
    if (!isAdmin || !user) {
      console.log('[useAdminFCM] Skipped: not admin or no user');
      return;
    }
    
    if (!isNative) {
      console.log('[useAdminFCM] Skipped: not native platform');
      return;
    }

    if (hasAttempted.current) {
      console.log('[useAdminFCM] Skipped: already attempted registration');
      return;
    }
    
    hasAttempted.current = true;
    console.log('[useAdminFCM] Starting FCM registration...');

    const registerPushNotifications = async () => {
      try {
        const isAvailable = Capacitor.isPluginAvailable('PushNotifications');
        console.log('[useAdminFCM] Plugin available:', isAvailable);
        
        if (!isAvailable) {
          setError('Push notifications plugin not available');
          return;
        }

        const module = await import('@capacitor/push-notifications');
        const PushNotifications = module.PushNotifications;
        console.log('[useAdminFCM] PushNotifications module loaded');

        // Check permissions
        const permissionStatus = await PushNotifications.checkPermissions();
        console.log('[useAdminFCM] Current permission status:', permissionStatus.receive);
        
        if (permissionStatus.receive === 'denied') {
          console.warn('[useAdminFCM] Permission previously denied');
          setError('Permission denied');
          return;
        }

        // Request permission
        console.log('[useAdminFCM] Requesting permissions...');
        const permissionResult = await PushNotifications.requestPermissions();
        console.log('[useAdminFCM] Permission result:', permissionResult.receive);
        
        if (permissionResult.receive !== 'granted') {
          console.warn('[useAdminFCM] Permission not granted');
          setError('Permission denied');
          return;
        }

        setIsSupported(true);
        console.log('[useAdminFCM] Permissions granted, setting up listeners...');

        // Registration listener
        await PushNotifications.addListener('registration', async (token: { value: string }) => {
          console.log('[useAdminFCM] ✅ FCM Token received:', token.value.substring(0, 20) + '...');
          
          try {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ fcm_token: token.value })
              .eq('id', user.id);
            
            if (updateError) {
              console.error('[useAdminFCM] ❌ Failed to store token:', updateError);
              setError('Failed to store token');
            } else {
              console.log('[useAdminFCM] ✅ Token stored successfully for user:', user.id);
              setIsRegistered(true);
            }
          } catch (dbError) {
            console.error('[useAdminFCM] ❌ Database error:', dbError);
            setError('Database error');
          }
        });

        // Error listener
        await PushNotifications.addListener('registrationError', (err: { error: string }) => {
          console.error('[useAdminFCM] ❌ Registration error:', err);
          setError(err.error || 'Registration failed');
        });

        // Notification received (foreground)
        await PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
          console.log('[useAdminFCM] 🔔 Push notification received (foreground):', notification);
        });

        // Notification tapped
        await PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
          console.log('[useAdminFCM] 🔔 Push notification action performed:', notification);
          if (notification.notification?.data?.type === 'purchase_request') {
            window.location.href = '/admin?tab=approvals';
          }
        });

        console.log('[useAdminFCM] Calling register()...');
        await PushNotifications.register();
        console.log('[useAdminFCM] register() called successfully, waiting for token...');
        
      } catch (err) {
        console.error('[useAdminFCM] ❌ Fatal error:', err);
        setError(err instanceof Error ? err.message : 'Registration failed');
      }
    };

    registerPushNotifications();
  }, [profile?.role, user]);

  return { isRegistered, error, isSupported };
};
