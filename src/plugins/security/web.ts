import { WebPlugin } from '@capacitor/core';
import type { SecurityPlugin } from './definitions';

/**
 * Web fallback for Security plugin
 * On web, we can't detect screenshots or recordings, so we just log warnings
 */
export class SecurityWeb extends WebPlugin implements SecurityPlugin {
  async isScreenRecording(): Promise<{ recording: boolean }> {
    console.warn('SecurityPlugin: isScreenRecording not available on web');
    return { recording: false };
  }

  async addListener(
    eventName: 'screenshotTaken',
    listenerFunc: () => void
  ): Promise<{ remove: () => Promise<void> }>;
  async addListener(
    eventName: 'screenRecordingChanged',
    listenerFunc: (data: { recording: boolean }) => void
  ): Promise<{ remove: () => Promise<void> }>;
  async addListener(
    eventName: string,
    _listenerFunc: unknown
  ): Promise<{ remove: () => Promise<void> }> {
    console.warn(`SecurityPlugin: ${eventName} listener not available on web`);
    return { remove: async () => {} };
  }

  async removeAllListeners(): Promise<void> {
    console.warn('SecurityPlugin: removeAllListeners not available on web');
  }
}
