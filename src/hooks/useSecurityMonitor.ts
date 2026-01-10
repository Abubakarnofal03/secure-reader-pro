import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Security } from '@/plugins/security';

interface SecurityState {
  isRecording: boolean;
  screenshotDetected: boolean;
  screenshotCount: number;
}

/**
 * Hook to monitor security events (screenshots, screen recording)
 * 
 * On Android: FLAG_SECURE blocks screenshots/recording at the OS level
 * On iOS: This hook detects events and can trigger UI responses
 * On Web: No protection available (returns default state)
 */
export function useSecurityMonitor() {
  const [securityState, setSecurityState] = useState<SecurityState>({
    isRecording: false,
    screenshotDetected: false,
    screenshotCount: 0,
  });

  const clearScreenshotAlert = useCallback(() => {
    setSecurityState((prev) => ({ ...prev, screenshotDetected: false }));
  }, []);

  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const platform = Capacitor.getPlatform();

    // On Android, FLAG_SECURE handles everything - no need for JS monitoring
    if (platform === 'android') {
      return;
    }

    // On iOS, set up listeners for screenshot and recording events
    let screenshotListener: { remove: () => Promise<void> } | null = null;
    let recordingListener: { remove: () => Promise<void> } | null = null;

    const setupListeners = async () => {
      try {
        // Check initial recording state
        const { recording } = await Security.isScreenRecording();
        setSecurityState((prev) => ({ ...prev, isRecording: recording }));

        // Listen for screenshots
        screenshotListener = await Security.addListener('screenshotTaken', () => {
          setSecurityState((prev) => ({
            ...prev,
            screenshotDetected: true,
            screenshotCount: prev.screenshotCount + 1,
          }));

          // Auto-clear after 3 seconds
          setTimeout(() => {
            setSecurityState((prev) => ({ ...prev, screenshotDetected: false }));
          }, 3000);
        });

        // Listen for recording state changes
        recordingListener = await Security.addListener(
          'screenRecordingChanged',
          (data: { recording: boolean }) => {
            setSecurityState((prev) => ({ ...prev, isRecording: data.recording }));
          }
        );
      } catch (error) {
        console.warn('Failed to set up security listeners:', error);
      }
    };

    setupListeners();

    return () => {
      screenshotListener?.remove();
      recordingListener?.remove();
    };
  }, []);

  return {
    ...securityState,
    clearScreenshotAlert,
    isNativePlatform: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
  };
}
