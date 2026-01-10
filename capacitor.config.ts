import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.35e1147ccd284977abb5f71cb7157e17',
  appName: 'SecureReader',
  webDir: 'dist',
  server: {
    url: 'https://35e1147c-cd28-4977-abb5-f71cb7157e17.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0F172A',
      showSpinner: false,
    }
  }
};

export default config;
