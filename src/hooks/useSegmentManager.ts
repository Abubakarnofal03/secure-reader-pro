import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/device';

interface Segment {
  id: string;
  segment_index: number;
  start_page: number;
  end_page: number;
  file_path: string;
}

interface SegmentCache {
  signedUrl: string;
  expiresAt: number;
}

interface UseSegmentManagerOptions {
  contentId: string | undefined;
  currentPage: number;
  enabled?: boolean;
}

interface UseSegmentManagerResult {
  segments: Segment[];
  isLoadingSegments: boolean;
  activeSegmentUrl: string | null;
  activeSegmentIndex: number | null;
  isLoadingSegment: boolean;
  getSegmentForPage: (pageNumber: number) => Segment | null;
  getSegmentUrl: (segmentIndex: number) => string | null;
  prefetchSegmentForPage: (pageNumber: number) => Promise<string | null>;
  totalPages: number;
  error: string | null;
  isSegmented: boolean;
}

// Short-lived signed URLs for security (60 seconds)
const SIGNED_URL_EXPIRY_SECONDS = 60;
// Refresh threshold - refresh when 15 seconds left
const REFRESH_THRESHOLD_MS = 15 * 1000;

export function useSegmentManager({
  contentId,
  currentPage,
  enabled = true,
}: UseSegmentManagerOptions): UseSegmentManagerResult {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoadingSegments, setIsLoadingSegments] = useState(true);
  const [isLoadingSegment, setIsLoadingSegment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  
  // Cache for signed URLs - keyed by segment index
  const urlCache = useRef<Map<number, SegmentCache>>(new Map());
  // Track which segments are currently being fetched
  const fetchingSegments = useRef<Set<number>>(new Set());
  
  // Force re-render when cache updates
  const [cacheVersion, setCacheVersion] = useState(0);

  // Fetch segments metadata on mount
  useEffect(() => {
    if (!contentId || !enabled) {
      setIsLoadingSegments(false);
      return;
    }

    const fetchSegments = async () => {
      setIsLoadingSegments(true);
      setError(null);

      try {
        // Fetch segments for this content
        const { data: segmentsData, error: segmentsError } = await supabase
          .from('content_segments')
          .select('*')
          .eq('content_id', contentId)
          .order('segment_index', { ascending: true });

        if (segmentsError) {
          throw new Error(`Failed to fetch segments: ${segmentsError.message}`);
        }

        // Also fetch total_pages from content table
        const { data: contentData, error: contentError } = await supabase
          .from('content')
          .select('total_pages')
          .eq('id', contentId)
          .single();

        if (contentError) {
          console.warn('Failed to fetch content metadata:', contentError);
        }

        // Type cast the segments data to our interface
        const typedSegments = (segmentsData || []) as unknown as Segment[];
        setSegments(typedSegments);
        setTotalPages(contentData?.total_pages || 0);
        
        // Clear URL cache when segments change
        urlCache.current.clear();
        setCacheVersion(v => v + 1);
      } catch (err) {
        console.error('Error fetching segments:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content segments');
      } finally {
        setIsLoadingSegments(false);
      }
    };

    fetchSegments();
  }, [contentId, enabled]);

  // Get segment for a given page number
  const getSegmentForPage = useCallback((pageNumber: number): Segment | null => {
    return segments.find(
      seg => pageNumber >= seg.start_page && pageNumber <= seg.end_page
    ) || null;
  }, [segments]);

  // Fetch signed URL for a segment
  const fetchSegmentUrl = useCallback(async (segment: Segment): Promise<string | null> => {
    // Check if already fetching
    if (fetchingSegments.current.has(segment.segment_index)) {
      return null;
    }

    // Check cache
    const cached = urlCache.current.get(segment.segment_index);
    if (cached && cached.expiresAt > Date.now() + REFRESH_THRESHOLD_MS) {
      return cached.signedUrl;
    }

    fetchingSegments.current.add(segment.segment_index);
    setIsLoadingSegment(true);

    try {
      const deviceId = await getDeviceId();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call edge function to get signed URL for segment
      const response = await supabase.functions.invoke('get-segment-url', {
        body: {
          content_id: contentId,
          segment_index: segment.segment_index,
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

      const signedUrl = data.signedUrl;
      const expiresAt = data.expiresAt || Date.now() + (SIGNED_URL_EXPIRY_SECONDS * 1000);

      // Cache the URL
      urlCache.current.set(segment.segment_index, { signedUrl, expiresAt });
      setCacheVersion(v => v + 1);

      return signedUrl;
    } catch (err) {
      console.error(`Error fetching segment ${segment.segment_index} URL:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load segment');
      return null;
    } finally {
      fetchingSegments.current.delete(segment.segment_index);
      setIsLoadingSegment(false);
    }
  }, [contentId]);

  // Get cached URL for a segment index
  const getSegmentUrl = useCallback((segmentIndex: number): string | null => {
    const cached = urlCache.current.get(segmentIndex);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.signedUrl;
    }
    return null;
  }, [cacheVersion]);

  // Determine active segment based on current page
  const activeSegment = useMemo(() => {
    return getSegmentForPage(currentPage);
  }, [currentPage, getSegmentForPage]);

  const activeSegmentIndex = activeSegment?.segment_index ?? null;

  // Auto-fetch active segment URL when current page changes
  useEffect(() => {
    if (!activeSegment || !enabled) return;

    const cached = urlCache.current.get(activeSegment.segment_index);
    if (!cached || cached.expiresAt <= Date.now() + REFRESH_THRESHOLD_MS) {
      fetchSegmentUrl(activeSegment);
    }
  }, [activeSegment, enabled, fetchSegmentUrl]);

  // Prefetch segment for a specific page (used for jump-to-page navigation)
  const prefetchSegmentForPage = useCallback(async (pageNumber: number): Promise<string | null> => {
    const segment = getSegmentForPage(pageNumber);
    if (!segment) return null;
    
    // Check if already cached and valid
    const cached = urlCache.current.get(segment.segment_index);
    if (cached && cached.expiresAt > Date.now() + REFRESH_THRESHOLD_MS) {
      return cached.signedUrl;
    }
    
    // Fetch the segment URL
    return fetchSegmentUrl(segment);
  }, [getSegmentForPage, fetchSegmentUrl]);

  // Prefetch adjacent segments for smooth scrolling
  useEffect(() => {
    if (!enabled || segments.length === 0) return;

    const prefetchAdjacent = async () => {
      const activeIdx = activeSegmentIndex ?? 0;
      
      // Prefetch next segment
      if (activeIdx < segments.length - 1) {
        const nextSegment = segments[activeIdx + 1];
        const nextCached = urlCache.current.get(nextSegment.segment_index);
        if (!nextCached || nextCached.expiresAt <= Date.now() + REFRESH_THRESHOLD_MS) {
          await fetchSegmentUrl(nextSegment);
        }
      }

      // Prefetch previous segment (if exists)
      if (activeIdx > 0) {
        const prevSegment = segments[activeIdx - 1];
        const prevCached = urlCache.current.get(prevSegment.segment_index);
        if (!prevCached || prevCached.expiresAt <= Date.now() + REFRESH_THRESHOLD_MS) {
          await fetchSegmentUrl(prevSegment);
        }
      }
    };

    // Delay prefetch to prioritize active segment
    const timeout = setTimeout(prefetchAdjacent, 500);
    return () => clearTimeout(timeout);
  }, [activeSegmentIndex, segments, enabled, fetchSegmentUrl]);

  // Get active segment URL from cache
  const activeSegmentUrl = useMemo(() => {
    if (activeSegmentIndex === null) return null;
    return getSegmentUrl(activeSegmentIndex);
  }, [activeSegmentIndex, getSegmentUrl, cacheVersion]);

  // Determine if content is segmented (has segments) or legacy (single file)
  const isSegmented = segments.length > 0;

  return {
    segments,
    isLoadingSegments,
    activeSegmentUrl,
    activeSegmentIndex,
    isLoadingSegment,
    getSegmentForPage,
    getSegmentUrl,
    prefetchSegmentForPage,
    totalPages,
    error,
    isSegmented,
  };
}
