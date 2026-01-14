import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export const useAdminFCM = () => {
  const { profile, user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only register FCM for admins on native platforms
    const isAdmin = profile?.role === 'admin';
    if (!isAdmin || !user) return;
    
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) {
      console.log('FCM registration skipped: not a native platform');
      return;
    }

    const registerPushNotifications = async () => {
      try {
        // Request permission
        const permissionResult = await PushNotifications.requestPermissions();
        
        if (permissionResult.receive !== 'granted') {
          console.log('Push notification permission denied');
          setError('Permission denied');
          return;
        }

        // Register with APNs/FCM
        await PushNotifications.register();

        // Listen for registration success
        PushNotifications.addListener('registration', async (token) => {
          console.log('FCM Token received:', token.value);
          
          // Store token in database
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
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (error) => {
          console.error('FCM registration error:', error);
          setError(error.error);
        });

        // Listen for push notifications received
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
        });

        // Listen for push notification action performed
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification action performed:', notification);
          // Handle navigation based on notification data
          if (notification.notification.data?.type === 'purchase_request') {
            // Could navigate to approvals tab
            window.location.href = '/admin?tab=approvals';
          }
        });
      } catch (err) {
        console.error('FCM registration failed:', err);
        setError(err instanceof Error ? err.message : 'Registration failed');
      }
    };

    registerPushNotifications();

    // Cleanup listeners on unmount
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [profile?.role, user]);

  return { isRegistered, error };
};
