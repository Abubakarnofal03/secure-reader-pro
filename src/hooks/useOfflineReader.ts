import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  getContentMetadata,
  getLocalSegmentUri,
  isContentFullyDownloaded,
  OfflineContentMetadata,
} from '@/services/offlineStorage';

interface OfflineSegment {
  index: number;
  startPage: number;
  endPage: number;
  localUri: string;
}

interface UseOfflineReaderOptions {
  contentId: string | undefined;
  currentPage: number;
  enabled?: boolean;
}

interface UseOfflineReaderResult {
  /** Whether offline content is available and being used */
  isOffline: boolean;
  /** Whether we're still checking offline availability */
  isCheckingOffline: boolean;
  /** Metadata for the offline content */
  metadata: OfflineContentMetadata | null;
  /** The local URI for the active segment (based on currentPage) */
  activeSegmentUrl: string | null;
  /** The active segment index */
  activeSegmentIndex: number | null;
  /** Total pages from offline metadata */
  totalPages: number;
  /** Get local URI for a specific segment index */
  getSegmentUrl: (segmentIndex: number) => string | null;
  /** Get the segment info for a given page */
  getSegmentForPage: (pageNumber: number) => { id: string; segment_index: number; start_page: number; end_page: number; file_path: string } | null;
  /** Segments list (compatible shape) */
  segments: { id: string; segment_index: number; start_page: number; end_page: number; file_path: string }[];
  /** Prefetch (no-op for offline, returns cached URI) */
  prefetchSegmentForPage: (pageNumber: number) => Promise<string | null>;
  /** No-op for offline */
  refreshAllUrls: () => Promise<void>;
  /** Always false for offline */
  isLoadingSegments: boolean;
  /** Always false for offline */
  isLoadingSegment: boolean;
  /** Always true when offline content is loaded */
  isSegmented: boolean;
  /** Always null for offline */
  error: string | null;
}

export function useOfflineReader({
  contentId,
  currentPage,
  enabled = true,
}: UseOfflineReaderOptions): UseOfflineReaderResult {
  const [isOffline, setIsOffline] = useState(false);
  const [isCheckingOffline, setIsCheckingOffline] = useState(true);
  const [metadata, setMetadata] = useState<OfflineContentMetadata | null>(null);
  const [offlineSegments, setOfflineSegments] = useState<OfflineSegment[]>([]);
  const uriCache = useRef<Map<number, string>>(new Map());

  const isNative = Capacitor.isNativePlatform();

  // Check if offline content is available
  useEffect(() => {
    if (!contentId || !enabled || !isNative) {
      setIsCheckingOffline(false);
      setIsOffline(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      setIsCheckingOffline(true);
      try {
        const isDownloaded = await isContentFullyDownloaded(contentId);
        if (cancelled) return;

        if (isDownloaded) {
          const meta = await getContentMetadata(contentId);
          if (cancelled) return;

          if (meta) {
            setMetadata(meta);

            // Pre-load all segment URIs
            const segs: OfflineSegment[] = [];
            for (const seg of meta.segments) {
              const uri = await getLocalSegmentUri(contentId, seg.index);
              if (uri) {
                segs.push({
                  index: seg.index,
                  startPage: seg.startPage,
                  endPage: seg.endPage,
                  localUri: uri,
                });
                uriCache.current.set(seg.index, uri);
              }
            }

            if (!cancelled) {
              setOfflineSegments(segs);
              setIsOffline(segs.length === meta.segments.length);
            }
          }
        } else {
          setIsOffline(false);
          setMetadata(null);
        }
      } catch (err) {
        console.error('[OfflineReader] Error checking offline availability:', err);
        setIsOffline(false);
      } finally {
        if (!cancelled) setIsCheckingOffline(false);
      }
    };

    check();
    return () => { cancelled = true; };
  }, [contentId, enabled, isNative]);

  const getSegmentForPage = useCallback(
    (pageNumber: number) => {
      const seg = offlineSegments.find(
        (s) => pageNumber >= s.startPage && pageNumber <= s.endPage,
      );
      if (!seg) return null;
      return {
        id: `offline-${seg.index}`,
        segment_index: seg.index,
        start_page: seg.startPage,
        end_page: seg.endPage,
        file_path: '',
      };
    },
    [offlineSegments],
  );

  const getSegmentUrl = useCallback(
    (segmentIndex: number): string | null => {
      return uriCache.current.get(segmentIndex) || null;
    },
    [offlineSegments], // dependency ensures re-evaluation after load
  );

  const activeSegment = useMemo(() => {
    return getSegmentForPage(currentPage);
  }, [currentPage, getSegmentForPage]);

  const activeSegmentUrl = useMemo(() => {
    if (!activeSegment) return null;
    return getSegmentUrl(activeSegment.segment_index);
  }, [activeSegment, getSegmentUrl]);

  const activeSegmentIndex = activeSegment?.segment_index ?? null;

  // Shape segments to match useSegmentManager interface
  const segments = useMemo(() => {
    return offlineSegments.map((s) => ({
      id: `offline-${s.index}`,
      segment_index: s.index,
      start_page: s.startPage,
      end_page: s.endPage,
      file_path: '',
    }));
  }, [offlineSegments]);

  const prefetchSegmentForPage = useCallback(
    async (pageNumber: number): Promise<string | null> => {
      const seg = getSegmentForPage(pageNumber);
      if (!seg) return null;
      return getSegmentUrl(seg.segment_index);
    },
    [getSegmentForPage, getSegmentUrl],
  );

  const refreshAllUrls = useCallback(async () => {
    // No-op for offline
  }, []);

  return {
    isOffline,
    isCheckingOffline,
    metadata,
    activeSegmentUrl,
    activeSegmentIndex,
    totalPages: metadata?.totalPages || 0,
    getSegmentUrl,
    getSegmentForPage,
    segments,
    prefetchSegmentForPage,
    refreshAllUrls,
    isLoadingSegments: false,
    isLoadingSegment: false,
    isSegmented: isOffline && offlineSegments.length > 0,
    error: null,
  };
}
