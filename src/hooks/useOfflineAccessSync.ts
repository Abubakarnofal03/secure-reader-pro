import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  getDownloadedContentIds,
  getContentMetadata,
  deleteContentCache,
} from '@/services/offlineStorage';

/**
 * Background hook that verifies the user still has access to all
 * locally downloaded content. Runs on app startup, network reconnection,
 * and visibility change. Deletes local cache for revoked content.
 */
export function useOfflineAccessSync() {
  const { user } = useAuth();
  const isRunning = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  const syncAccess = useCallback(async () => {
    if (!isNative || !user || isRunning.current) return;
    if (!navigator.onLine) return;

    isRunning.current = true;

    try {
      const downloadedIds = await getDownloadedContentIds();
      if (downloadedIds.length === 0) return;

      // Check which content the user still has access to
      const { data: accessData, error } = await supabase
        .from('user_content_access')
        .select('content_id')
        .eq('user_id', user.id)
        .in('content_id', downloadedIds);

      if (error) {
        console.error('[OfflineSync] Error checking access:', error);
        return;
      }

      const accessSet = new Set(accessData?.map((a) => a.content_id) || []);

      // Delete local cache for revoked content
      for (const contentId of downloadedIds) {
        if (!accessSet.has(contentId)) {
          const meta = await getContentMetadata(contentId);
          const title = meta?.title || 'a publication';

          console.log(`[OfflineSync] Access revoked for ${contentId}, deleting local cache`);
          await deleteContentCache(contentId);

          toast.error(`Access to "${title}" has been revoked. The offline copy has been removed.`);
        }
      }
    } catch (err) {
      console.error('[OfflineSync] Sync error:', err);
    } finally {
      isRunning.current = false;
    }
  }, [user, isNative]);

  useEffect(() => {
    if (!isNative || !user) return;

    // Run on mount
    syncAccess();

    // Run when app comes back online
    const handleOnline = () => syncAccess();
    window.addEventListener('online', handleOnline);

    // Run when app becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncAccess();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncAccess, isNative, user]);
}
