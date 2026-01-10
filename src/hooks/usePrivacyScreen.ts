import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PrivacyScreen } from '@capacitor/privacy-screen';

/**
 * Hook to enable privacy screen protection on native platforms.
 * 
 * On Android: Applies FLAG_SECURE which blocks screenshots and screen recording entirely.
 * On iOS: Blurs content in app switcher and hides content during screen recording.
 * On Web: No-op (no protection available).
 * 
 * @param enabled - Whether to enable privacy protection (default: true)
 */
export function usePrivacyScreen(enabled: boolean = true) {
  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (!enabled) {
      return;
    }

    const enableProtection = async () => {
      try {
        await PrivacyScreen.enable();
        console.log('Privacy screen protection enabled');
      } catch (error) {
        console.warn('Failed to enable privacy screen:', error);
      }
    };

    const disableProtection = async () => {
      try {
        await PrivacyScreen.disable();
        console.log('Privacy screen protection disabled');
      } catch (error) {
        console.warn('Failed to disable privacy screen:', error);
      }
    };

    enableProtection();

    return () => {
      disableProtection();
    };
  }, [enabled]);
}
