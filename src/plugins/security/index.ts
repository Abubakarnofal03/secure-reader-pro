import { registerPlugin } from '@capacitor/core';
import type { SecurityPlugin } from './definitions';

/**
 * Security Plugin for Capacitor
 * 
 * On Android: FLAG_SECURE in MainActivity blocks screenshots/recording
 * On iOS: This plugin detects and notifies when screenshots/recordings occur
 * 
 * The native implementation must be added manually when building:
 * - Android: Add FLAG_SECURE to MainActivity.java
 * - iOS: Add SecurityPlugin.swift to the project
 */
const Security = registerPlugin<SecurityPlugin>('Security', {
  web: () => import('./web').then((m) => new m.SecurityWeb()),
});

export * from './definitions';
export { Security };
