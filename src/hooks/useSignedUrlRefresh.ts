import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/device';

interface UseSignedUrlRefreshOptions {
  contentId: string | undefined;
  initialUrl: string | null;
  initialExpiresAt: number | null;
  enabled: boolean;
  onUrlRefreshed: (newUrl: string, newExpiresAt: number) => void;
  onRefreshError: (error: Error) => void;
}

// Refresh URL when less than this many ms remaining
const REFRESH_THRESHOLD_MS = 60 * 1000; // 1 minute
// Check interval
const CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
// Max retry attempts
const MAX_RETRIES = 3;
// Retry delay
const RETRY_DELAY_MS = 1000;

/**
 * Hook to automatically refresh Supabase signed URLs before they expire.
 * This prevents loading failures during long reading sessions.
 * Also handles visibility changes to recover from app backgrounding.
 */
export function useSignedUrlRefresh({
  contentId,
  initialUrl,
  initialExpiresAt,
  enabled,
  onUrlRefreshed,
  onRefreshError,
}: UseSignedUrlRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currentExpiresAtRef = useRef<number | null>(initialExpiresAt);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastVisibleTimeRef = useRef(Date.now());
  const retryCountRef = useRef(0);

  // Update ref when initial values change
  useEffect(() => {
    currentExpiresAtRef.current = initialExpiresAt;
  }, [initialExpiresAt]);

  const refreshUrl = useCallback(async (retryCount = 0): Promise<boolean> => {
    if (!contentId || isRefreshing) return false;

    try {
      setIsRefreshing(true);
      
      // First ensure we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.log('[SignedUrlRefresh] No valid session, attempting refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          throw new Error('Session expired - please log in again');
        }
        console.log('[SignedUrlRefresh] Session refreshed successfully');
      }
      
      const deviceId = await getDeviceId();
      
      const response = await supabase.functions.invoke('render-pdf-page', {
        body: {
          content_id: contentId,
          page_number: 1,
          device_id: deviceId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.signedUrl && data.expiresAt) {
        currentExpiresAtRef.current = data.expiresAt;
        retryCountRef.current = 0;
        onUrlRefreshed(data.signedUrl, data.expiresAt);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('[SignedUrlRefresh] Refresh attempt failed:', err);
      
      // Retry logic
      if (retryCount < MAX_RETRIES - 1) {
        console.log(`[SignedUrlRefresh] Retrying in ${RETRY_DELAY_MS}ms (attempt ${retryCount + 2}/${MAX_RETRIES})...`);
        setIsRefreshing(false);
        
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return refreshUrl(retryCount + 1);
      }
      
      retryCountRef.current = retryCount + 1;
      onRefreshError(err instanceof Error ? err : new Error('Failed to refresh URL'));
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [contentId, isRefreshing, onUrlRefreshed, onRefreshError]);

  // Handle visibility change - refresh when app becomes visible
  useEffect(() => {
    if (!enabled || !contentId) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const hiddenDuration = Date.now() - lastVisibleTimeRef.current;
        console.log(`[SignedUrlRefresh] App became visible after ${Math.round(hiddenDuration / 1000)}s`);
        
        // Check if URL expired while hidden
        const expiresAt = currentExpiresAtRef.current;
        const now = Date.now();
        
        if (!expiresAt || expiresAt <= now + REFRESH_THRESHOLD_MS) {
          console.log('[SignedUrlRefresh] URL expired or expiring soon, refreshing...');
          await refreshUrl();
        } else if (hiddenDuration > 60 * 1000) {
          // If hidden for more than 1 minute, proactively refresh
          console.log('[SignedUrlRefresh] Hidden for >1min, proactively refreshing...');
          await refreshUrl();
        }
      } else {
        lastVisibleTimeRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, contentId, refreshUrl]);

  // Set up periodic check
  useEffect(() => {
    if (!enabled || !initialUrl || !contentId) {
      return;
    }

    const checkAndRefresh = () => {
      const expiresAt = currentExpiresAtRef.current;
      if (!expiresAt) return;

      const now = Date.now();
      const timeRemaining = expiresAt - now;

      if (timeRemaining < REFRESH_THRESHOLD_MS) {
        console.log(`[SignedUrlRefresh] URL expires in ${Math.round(timeRemaining / 1000)}s, refreshing...`);
        refreshUrl();
      }
    };

    // Initial check
    checkAndRefresh();

    // Set up interval
    intervalRef.current = setInterval(checkAndRefresh, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, initialUrl, contentId, refreshUrl]);

  return {
    isRefreshing,
    refreshUrl: () => refreshUrl(0),
  };
}
