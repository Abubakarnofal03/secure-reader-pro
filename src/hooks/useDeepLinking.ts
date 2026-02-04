import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to handle deep links in the native app.
 * Listens for app URL open events and navigates to the appropriate route.
 * Also handles session establishment from auth tokens in deep links.
 * Supports push notification deep links for specific content/screens.
 */
export function useDeepLinking() {
  const navigate = useNavigate();

  useEffect(() => {
    // Only set up deep linking on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleDeepLink = async (event: URLOpenListenerEvent) => {
      console.log('[DeepLinking] Deep link received:', event.url);

      try {
        const url = new URL(event.url);
        
        // Handle different URL formats:
        // 1. Custom scheme: mycalorics://reset-password?token=...
        // 2. Universal link: https://yourdomain.com/reset-password#access_token=...
        // 3. Push notification deep links: mycalorics://library, mycalorics://reader/123
        
        let pathname = url.pathname;
        let hash = url.hash;
        let search = url.search;

        // For custom URL schemes, the host might be the path
        if (url.protocol === 'mycalorics:') {
          pathname = '/' + url.host + url.pathname;
          // Clean up double slashes
          pathname = pathname.replace(/\/+/g, '/');
        }

        console.log('[DeepLinking] Parsed pathname:', pathname, 'search:', search, 'hash:', hash);

        // Extract tokens from search params (sent by AuthCallbackPage)
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');
        const type = url.searchParams.get('type');

        // If we have tokens, establish the Supabase session
        if (accessToken && refreshToken) {
          console.log('[DeepLinking] Setting session from deep link tokens...');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('[DeepLinking] Failed to set session from deep link:', error);
          } else {
            console.log('[DeepLinking] Session established from deep link');
          }
        }

        // Handle password reset links
        if (pathname.includes('reset-password') || type === 'recovery') {
          console.log('[DeepLinking] Navigating to reset-password');
          navigate(`/reset-password${hash}${search}`);
          return;
        }

        // Handle email confirmation links
        if (pathname.includes('confirm') || type === 'signup' || type === 'email') {
          console.log('[DeepLinking] Email confirmed, navigating to library');
          navigate('/library');
          return;
        }

        // Handle magic links
        if (pathname.includes('verify') || hash.includes('access_token')) {
          navigate(`/${hash}`);
          return;
        }

        // Handle push notification deep links
        // Admin routes
        if (pathname.includes('/admin')) {
          console.log('[DeepLinking] Navigating to admin screen');
          navigate(pathname + search);
          return;
        }

        // Reader route with content ID
        if (pathname.includes('/reader/')) {
          console.log('[DeepLinking] Navigating to reader');
          navigate(pathname);
          return;
        }

        // Library with optional params
        if (pathname.includes('/library')) {
          console.log('[DeepLinking] Navigating to library');
          navigate(pathname + search);
          return;
        }

        // Profile
        if (pathname.includes('/profile')) {
          console.log('[DeepLinking] Navigating to profile');
          navigate('/profile');
          return;
        }

        // Default: navigate to the path if valid, otherwise library
        if (pathname && pathname !== '/' && pathname !== '//') {
          console.log('[DeepLinking] Navigating to path:', pathname);
          navigate(pathname + search);
        } else {
          console.log('[DeepLinking] Default navigation to library');
          navigate('/library');
        }
      } catch (error) {
        console.error('[DeepLinking] Error handling deep link:', error);
        // On error, default to library
        navigate('/library');
      }
    };

    // Listen for app URL open events
    const listener = App.addListener('appUrlOpen', handleDeepLink);

    // Check if app was opened with a URL (cold start)
    App.getLaunchUrl().then((result) => {
      if (result?.url) {
        console.log('[DeepLinking] App launched with URL:', result.url);
        handleDeepLink({ url: result.url });
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [navigate]);
}
