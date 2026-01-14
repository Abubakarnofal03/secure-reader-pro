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
  const listenersRegistered = useRef(false);

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
        let PushNotifications: any;
        try {
          const module = await import('@capacitor/push-notifications');
          PushNotifications = module.PushNotifications;
        } catch (importError) {
          console.error('Failed to import PushNotifications:', importError);
          setError('Push notifications module not available');
          return;
        }

        if (!PushNotifications) {
          console.log('PushNotifications not loaded');
          setError('Push notifications not loaded');
          return;
        }
        
        // Check current permission status first - wrap in try-catch
        let permissionStatus;
        try {
          permissionStatus = await PushNotifications.checkPermissions();
        } catch (permError) {
          console.error('Failed to check permissions:', permError);
          setError('Failed to check notification permissions');
          return;
        }
        
        // If already denied, don't prompt again
        if (permissionStatus.receive === 'denied') {
          console.log('Push notification permission previously denied');
          setError('Permission denied');
          return;
        }

        // Request permission - wrap in try-catch
        let permissionResult;
        try {
          permissionResult = await PushNotifications.requestPermissions();
        } catch (reqError) {
          console.error('Failed to request permissions:', reqError);
          setError('Failed to request notification permissions');
          return;
        }
        
        if (permissionResult.receive !== 'granted') {
          console.log('Push notification permission not granted');
          setError('Permission denied');
          return;
        }

        setIsSupported(true);

        // Set up listeners BEFORE calling register() - only if not already registered
        if (!listenersRegistered.current) {
          listenersRegistered.current = true;
          
          try {
            await PushNotifications.addListener('registration', async (token: { value: string }) => {
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

            await PushNotifications.addListener('registrationError', (err: { error: string }) => {
              console.error('FCM registration error:', err);
              setError(err.error || 'Registration failed');
            });

            await PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
              console.log('Push notification received:', notification);
            });

            await PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
              console.log('Push notification action performed:', notification);
              if (notification.notification?.data?.type === 'purchase_request') {
                window.location.href = '/admin?tab=approvals';
              }
            });
          } catch (listenerError) {
            console.error('Failed to add listeners:', listenerError);
            // Continue anyway - registration might still work
          }
        }

        // Now register with APNs/FCM - wrap in separate try-catch
        try {
          await PushNotifications.register();
        } catch (registerError) {
          console.error('FCM register() failed:', registerError);
          setError('Failed to register for push notifications');
          // Don't crash - this is expected if Firebase is misconfigured
        }
        
      } catch (err) {
        // Catch any errors to prevent app crash
        console.error('FCM registration failed:', err);
        setError(err instanceof Error ? err.message : 'Registration failed');
        // Don't crash the app - just log and continue
      }
    };

    // Delay registration to ensure app is fully loaded and Firebase is initialized
    const timeoutId = setTimeout(() => {
      registerPushNotifications();
    }, 2000);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
    };
  }, [profile?.role, user]);

  return { isRegistered, error, isSupported };
};
