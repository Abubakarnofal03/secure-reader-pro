/**
 * Background auto-cache hook: silently downloads and caches PDF segments
 * as the user reads a publication, so future opens are faster / offline.
 */
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/device';
import {
  downloadSegmentAuto,
  saveContentMetadata,
  hasLocalSegment,
  getContentMetadata,
  OfflineContentMetadata,
} from '@/services/offlineStorage';

interface UseAutoCacheOptions {
  contentId: string | undefined;
  enabled: boolean;
  title?: string;
  watermarkName?: string;
  watermarkEmail?: string;
}

export function useAutoCache({
  contentId,
  enabled,
  title,
  watermarkName,
  watermarkEmail,
}: UseAutoCacheOptions) {
  const isCaching = useRef(false);
  const cachedRef = useRef(false);

  useEffect(() => {
    if (!contentId || !enabled || !Capacitor.isNativePlatform() || isCaching.current || cachedRef.current) return;

    let cancelled = false;

    const cacheInBackground = async () => {
      // Check if already fully downloaded
      const existingMeta = await getContentMetadata(contentId);
      if (existingMeta) {
        cachedRef.current = true;
        return; // Already cached
      }

      isCaching.current = true;

      try {
        // Fetch segment metadata
        const { data: segmentsData, error: segError } = await supabase
          .from('content_segments')
          .select('*')
          .eq('content_id', contentId)
          .order('segment_index', { ascending: true });

        if (segError || !segmentsData || segmentsData.length === 0 || cancelled) return;

        const { data: contentData } = await supabase
          .from('content')
          .select('total_pages, title, table_of_contents')
          .eq('id', contentId)
          .single();

        if (cancelled) return;

        const deviceId = await getDeviceId();
        const segmentMeta: OfflineContentMetadata['segments'] = [];

        for (let i = 0; i < segmentsData.length; i++) {
          if (cancelled) return;

          const seg = segmentsData[i];

          // Skip if already cached locally
          const exists = await hasLocalSegment(contentId, seg.segment_index);
          if (exists) {
            segmentMeta.push({
              index: seg.segment_index,
              startPage: seg.start_page,
              endPage: seg.end_page,
              fileName: `segment-${seg.segment_index}.pdf`,
            });
            continue;
          }

          try {
            // Get signed URL
            const { data: urlData, error: urlError } = await supabase.functions.invoke(
              'get-segment-url',
              {
                body: {
                  content_id: contentId,
                  segment_index: seg.segment_index,
                  device_id: deviceId,
                },
              },
            );

            if (urlError || urlData?.error || cancelled) continue;

            // Download and save - with a small delay to avoid overloading
            await downloadSegmentAuto(contentId, seg.segment_index, urlData.signedUrl);

            segmentMeta.push({
              index: seg.segment_index,
              startPage: seg.start_page,
              endPage: seg.end_page,
              fileName: `segment-${seg.segment_index}.pdf`,
            });

            // Small delay between segments to keep UI responsive
            await new Promise(r => setTimeout(r, 200));
          } catch (err) {
            console.warn(`[AutoCache] Failed to cache segment ${seg.segment_index}:`, err);
            // Continue with other segments
          }
        }

        if (cancelled || segmentMeta.length === 0) return;

        // Save metadata
        await saveContentMetadata({
          contentId,
          title: title || contentData?.title || 'Untitled',
          totalSegments: segmentsData.length,
          totalPages: contentData?.total_pages || 0,
          downloadedAt: new Date().toISOString(),
          segments: segmentMeta,
          watermark: watermarkName
            ? { userName: watermarkName, userEmail: watermarkEmail || '' }
            : undefined,
          tableOfContents: contentData?.table_of_contents || undefined,
        });

        cachedRef.current = true;
        console.log(`[AutoCache] Background caching complete for ${contentId} (${segmentMeta.length} segments)`);
      } catch (err) {
        console.warn('[AutoCache] Background caching failed:', err);
      } finally {
        isCaching.current = false;
      }
    };

    // Start caching after a delay to let the reader load first
    const timer = setTimeout(cacheInBackground, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [contentId, enabled, title, watermarkName, watermarkEmail]);
}
