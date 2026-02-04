import { useFCM } from '@/hooks/useFCM';

/**
 * Component that handles FCM push notification registration for all users.
 * Must be rendered inside AuthProvider.
 */
export function FCMHandler() {
  useFCM();
  return null;
}
