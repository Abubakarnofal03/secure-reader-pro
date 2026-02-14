import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/device';
import {
  downloadSegment,
  saveContentMetadata,
  isContentFullyDownloaded,
  deleteContentCache,
  getDownloadedContentIds,
  OfflineContentMetadata,
} from '@/services/offlineStorage';

interface UseOfflineDownloadResult {
  downloadContent: (contentId: string, title: string, watermarkName?: string, watermarkEmail?: string) => Promise<void>;
  removeDownload: (contentId: string) => Promise<void>;
  isDownloaded: (contentId: string) => boolean;
  isDownloading: boolean;
  downloadingContentId: string | null;
  downloadProgress: number;
  downloadError: string | null;
  downloadedContentIds: string[];
  refreshDownloadedList: () => Promise<void>;
}

export function useOfflineDownload(): UseOfflineDownloadResult {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingContentId, setDownloadingContentId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadedContentIds, setDownloadedContentIds] = useState<string[]>([]);
  const cancelRef = useRef(false);

  const isNative = Capacitor.isNativePlatform();

  const refreshDownloadedList = useCallback(async () => {
    if (!isNative) return;
    const ids = await getDownloadedContentIds();
    setDownloadedContentIds(ids);
  }, [isNative]);

  // Load downloaded list on mount
  useEffect(() => {
    refreshDownloadedList();
  }, [refreshDownloadedList]);

  const isDownloaded = useCallback(
    (contentId: string) => downloadedContentIds.includes(contentId),
    [downloadedContentIds],
  );

  const downloadContent = useCallback(
    async (contentId: string, title: string, watermarkName?: string, watermarkEmail?: string) => {
      if (!isNative) return;
      if (isDownloading) return;

      setIsDownloading(true);
      setDownloadingContentId(contentId);
      setDownloadProgress(0);
      setDownloadError(null);
      cancelRef.current = false;

      try {
        // 1. Fetch segment metadata from DB
        const { data: segmentsData, error: segError } = await supabase
          .from('content_segments')
          .select('*')
          .eq('content_id', contentId)
          .order('segment_index', { ascending: true });

        if (segError || !segmentsData || segmentsData.length === 0) {
          throw new Error('No segments found for this content');
        }

        // Fetch total pages
        const { data: contentData } = await supabase
          .from('content')
          .select('total_pages')
          .eq('id', contentId)
          .single();

        const totalSegments = segmentsData.length;
        const deviceId = await getDeviceId();

        // 2. For each segment, get signed URL and download
        const segmentMeta: OfflineContentMetadata['segments'] = [];

        for (let i = 0; i < totalSegments; i++) {
          if (cancelRef.current) {
            // Clean up partial download
            await deleteContentCache(contentId);
            break;
          }

          const seg = segmentsData[i];

          // Get signed URL via edge function
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

          if (urlError || urlData?.error) {
            throw new Error(urlData?.error || urlError?.message || 'Failed to get segment URL');
          }

          // Download and save segment
          await downloadSegment(contentId, seg.segment_index, urlData.signedUrl);

          segmentMeta.push({
            index: seg.segment_index,
            startPage: seg.start_page,
            endPage: seg.end_page,
            fileName: `segment-${seg.segment_index}.pdf`,
          });

          setDownloadProgress(Math.round(((i + 1) / totalSegments) * 100));
        }

        if (!cancelRef.current) {
          // 3. Save metadata
          await saveContentMetadata({
            contentId,
            title,
            totalSegments,
            totalPages: contentData?.total_pages || 0,
            downloadedAt: new Date().toISOString(),
            segments: segmentMeta,
            watermark: watermarkName
              ? { userName: watermarkName, userEmail: watermarkEmail || '' }
              : undefined,
          });

          // 4. Refresh list
          await refreshDownloadedList();
        }
      } catch (err) {
        console.error('[OfflineDownload] Error:', err);
        setDownloadError(err instanceof Error ? err.message : 'Download failed');
        // Clean up partial download on error
        await deleteContentCache(contentId).catch(() => {});
      } finally {
        setIsDownloading(false);
        setDownloadingContentId(null);
      }
    },
    [isNative, isDownloading, refreshDownloadedList],
  );

  const removeDownload = useCallback(
    async (contentId: string) => {
      if (!isNative) return;
      await deleteContentCache(contentId);
      await refreshDownloadedList();
    },
    [isNative, refreshDownloadedList],
  );

  return {
    downloadContent,
    removeDownload,
    isDownloaded,
    isDownloading,
    downloadingContentId,
    downloadProgress,
    downloadError,
    downloadedContentIds,
    refreshDownloadedList,
  };
}
