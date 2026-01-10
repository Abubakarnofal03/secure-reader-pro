/**
 * Security Plugin Definitions for Capacitor
 * Used to detect screenshots and screen recording on iOS
 * On Android, FLAG_SECURE handles this natively
 */

export interface SecurityPlugin {
  /**
   * Check if screen recording is currently active (iOS only)
   */
  isScreenRecording(): Promise<{ recording: boolean }>;

  /**
   * Add a listener for screenshot events
   */
  addListener(
    eventName: 'screenshotTaken',
    listenerFunc: () => void
  ): Promise<{ remove: () => Promise<void> }>;

  /**
   * Add a listener for screen recording state changes
   */
  addListener(
    eventName: 'screenRecordingChanged',
    listenerFunc: (data: { recording: boolean }) => void
  ): Promise<{ remove: () => Promise<void> }>;

  /**
   * Remove all listeners
   */
  removeAllListeners(): Promise<void>;
}

export interface ScreenshotEvent {
  timestamp: string;
}

export interface ScreenRecordingEvent {
  recording: boolean;
}
