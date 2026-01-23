import { useState, useCallback, useRef, useEffect } from 'react';

interface CachedDocument {
  url: string;
  loadedAt: number;
}

interface UseSegmentDocumentCacheOptions {
  // How long to keep a cached URL valid (default 5 minutes)
  maxCacheAge?: number;
}

/**
 * Caches segment URLs to prevent unnecessary re-downloads.
 * Once a segment URL is used to load a PDF, we keep using that URL
 * until it becomes stale (exceeds maxCacheAge) or fails to load.
 * 
 * This prevents the constant loading bug where segment URL refreshes
 * cause all visible pages to re-download their PDFs.
 */
export function useSegmentDocumentCache(options: UseSegmentDocumentCacheOptions = {}) {
  const { maxCacheAge = 5 * 60 * 1000 } = options; // 5 minutes default
  
  // Map of segment index -> cached URL info
  const documentCache = useRef<Map<number, CachedDocument>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);

  /**
   * Get a stable URL for a segment. If we have a cached URL that's still valid,
   * return that. Otherwise, use the new URL and cache it.
   */
  const getStableUrl = useCallback((
    segmentIndex: number, 
    freshUrl: string | null
  ): string | null => {
    if (!freshUrl) return null;

    const cached = documentCache.current.get(segmentIndex);
    const now = Date.now();

    // If we have a cached URL that's not too old, use it
    if (cached && (now - cached.loadedAt) < maxCacheAge) {
      return cached.url;
    }

    // Cache the new URL
    documentCache.current.set(segmentIndex, {
      url: freshUrl,
      loadedAt: now,
    });
    
    return freshUrl;
  }, [maxCacheAge]);

  /**
   * Mark a segment URL as successfully loaded. This ensures we keep using
   * this URL until it expires.
   */
  const markLoaded = useCallback((segmentIndex: number, url: string) => {
    const cached = documentCache.current.get(segmentIndex);
    // Only update if URL matches (avoid race conditions)
    if (cached?.url === url) {
      documentCache.current.set(segmentIndex, {
        url,
        loadedAt: Date.now(),
      });
    }
  }, []);

  /**
   * Mark a segment URL as failed. This removes it from cache so we'll
   * try a fresh URL on next render.
   */
  const markFailed = useCallback((segmentIndex: number) => {
    documentCache.current.delete(segmentIndex);
    setCacheVersion(v => v + 1);
  }, []);

  /**
   * Clear all cached URLs. Use when switching content.
   */
  const clearCache = useCallback(() => {
    documentCache.current.clear();
    setCacheVersion(v => v + 1);
  }, []);

  /**
   * Get stats for debugging
   */
  const getCacheStats = useCallback(() => {
    return {
      size: documentCache.current.size,
      entries: Array.from(documentCache.current.entries()).map(([idx, doc]) => ({
        segmentIndex: idx,
        url: doc.url.substring(0, 50) + '...',
        age: Math.round((Date.now() - doc.loadedAt) / 1000) + 's',
      })),
    };
  }, []);

  return {
    getStableUrl,
    markLoaded,
    markFailed,
    clearCache,
    getCacheStats,
    cacheVersion,
  };
}
