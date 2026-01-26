import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.securereader.app',
  appName: 'SecureReader',
  webDir: 'dist',
  server: {
    // For production builds, remove the URL to use bundled assets
    // url: 'https://35e1147c-cd28-4977-abb5-f71cb7157e17.lovableproject.com?forceHideBadge=true',
    cleartext: false, // Disable cleartext for security
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0F172A',
      showSpinner: false,
      launchAutoHide: true,
    },
    // Deep linking configuration
    App: {
      // URL schemes the app can handle
      // Android: Handled via AndroidManifest.xml intent filters
      // iOS: Handled via Info.plist URL Types
    },
  },
  android: {
    // Android-specific security settings
    // FLAG_SECURE will be added in MainActivity.java
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    // iOS-specific settings
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
};

export default config;
