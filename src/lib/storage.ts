/**
 * Cross-platform storage utility for Capacitor apps.
 * Uses Capacitor Preferences on native platforms for persistent storage
 * that survives app restarts and WebView clears.
 * Falls back to localStorage on web.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

class StorageAdapter {
  private isNative = Capacitor.isNativePlatform();

  async getItem(key: string): Promise<string | null> {
    if (this.isNative) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.isNative) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (this.isNative) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  }

  async clear(): Promise<void> {
    if (this.isNative) {
      await Preferences.clear();
    } else {
      localStorage.clear();
    }
  }
}

export const storage = new StorageAdapter();

/**
 * Custom storage adapter for Supabase Auth that uses Capacitor Preferences.
 * This ensures session tokens persist across app restarts on mobile.
 */
export const supabaseStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return storage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await storage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await storage.removeItem(key);
  },
};
