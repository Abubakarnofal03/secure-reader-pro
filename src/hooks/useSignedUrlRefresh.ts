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

/**
 * Hook to automatically refresh Supabase signed URLs before they expire.
 * This prevents loading failures during long reading sessions.
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

  // Update ref when initial values change
  useEffect(() => {
    currentExpiresAtRef.current = initialExpiresAt;
  }, [initialExpiresAt]);

  const refreshUrl = useCallback(async () => {
    if (!contentId || isRefreshing) return;

    try {
      setIsRefreshing(true);
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
        onUrlRefreshed(data.signedUrl, data.expiresAt);
      }
    } catch (err) {
      onRefreshError(err instanceof Error ? err : new Error('Failed to refresh URL'));
    } finally {
      setIsRefreshing(false);
    }
  }, [contentId, isRefreshing, onUrlRefreshed, onRefreshError]);

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
    refreshUrl,
  };
}
