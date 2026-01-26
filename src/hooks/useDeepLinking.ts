import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to handle deep links in the native app.
 * Listens for app URL open events and navigates to the appropriate route.
 */
export function useDeepLinking() {
  const navigate = useNavigate();

  useEffect(() => {
    // Only set up deep linking on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleDeepLink = (event: URLOpenListenerEvent) => {
      console.log('Deep link received:', event.url);

      try {
        const url = new URL(event.url);
        
        // Handle different URL formats:
        // 1. Custom scheme: securereader://reset-password?token=...
        // 2. Universal link: https://yourdomain.com/reset-password#access_token=...
        
        let pathname = url.pathname;
        let hash = url.hash;
        let search = url.search;

        // For custom URL schemes, the host might be the path
        if (url.protocol === 'securereader:') {
          pathname = '/' + url.host + url.pathname;
        }

        // Handle password reset links
        if (pathname.includes('reset-password')) {
          // Navigate with hash preserved for token extraction
          navigate(`/reset-password${hash}${search}`);
          return;
        }

        // Handle email confirmation links
        if (pathname.includes('confirm') || url.searchParams.get('type') === 'signup') {
          // The auth state listener will handle the session
          navigate('/library');
          return;
        }

        // Handle magic links
        if (pathname.includes('verify') || hash.includes('access_token')) {
          // Navigate to the app, auth state listener will pick up the session
          navigate(`/${hash}`);
          return;
        }

        // Default: navigate to the path
        if (pathname && pathname !== '/') {
          navigate(pathname + search + hash);
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };

    // Listen for app URL open events
    const listener = App.addListener('appUrlOpen', handleDeepLink);

    // Check if app was opened with a URL (cold start)
    App.getLaunchUrl().then((result) => {
      if (result?.url) {
        handleDeepLink({ url: result.url });
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [navigate]);
}
