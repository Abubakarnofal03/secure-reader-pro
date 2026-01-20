import { useRef, useCallback, useEffect } from 'react';

interface PageCacheOptions {
  maxCachedPages: number;
  contentId: string;
}

interface CacheEntry {
  url: string;
  lastAccessed: number;
}

/**
 * In-memory LRU cache for rendered PDF pages.
 * Stores blob URLs of rendered canvas images for instant display when scrolling back.
 * Cache is cleared on unmount - nothing persists to storage for security.
 */
export function usePageCache({ maxCachedPages, contentId }: PageCacheOptions) {
  // Map of pageNumber -> blob URL
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const contentIdRef = useRef(contentId);

  // Clear cache when contentId changes
  useEffect(() => {
    if (contentIdRef.current !== contentId) {
      // Revoke all old blob URLs to prevent memory leaks
      cacheRef.current.forEach((entry) => {
        URL.revokeObjectURL(entry.url);
      });
      cacheRef.current.clear();
      contentIdRef.current = contentId;
    }
  }, [contentId]);

  // Cleanup on unmount
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      cache.forEach((entry) => {
        URL.revokeObjectURL(entry.url);
      });
      cache.clear();
    };
  }, []);

  const getCacheKey = useCallback((pageNumber: number) => {
    return `${contentId}-${pageNumber}`;
  }, [contentId]);

  const getCachedPage = useCallback((pageNumber: number): string | null => {
    const key = getCacheKey(pageNumber);
    const entry = cacheRef.current.get(key);
    
    if (entry) {
      // Update last accessed time for LRU
      entry.lastAccessed = Date.now();
      return entry.url;
    }
    
    return null;
  }, [getCacheKey]);

  const cachePage = useCallback((pageNumber: number, blobUrl: string) => {
    const key = getCacheKey(pageNumber);
    
    // Don't cache if already exists
    if (cacheRef.current.has(key)) {
      // Revoke the new URL since we're not using it
      URL.revokeObjectURL(blobUrl);
      return;
    }

    // Evict oldest entries if at capacity
    if (cacheRef.current.size >= maxCachedPages) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      cacheRef.current.forEach((entry, entryKey) => {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = entryKey;
        }
      });

      if (oldestKey) {
        const oldEntry = cacheRef.current.get(oldestKey);
        if (oldEntry) {
          URL.revokeObjectURL(oldEntry.url);
        }
        cacheRef.current.delete(oldestKey);
      }
    }

    // Add new entry
    cacheRef.current.set(key, {
      url: blobUrl,
      lastAccessed: Date.now(),
    });
  }, [getCacheKey, maxCachedPages]);

  const clearCache = useCallback(() => {
    cacheRef.current.forEach((entry) => {
      URL.revokeObjectURL(entry.url);
    });
    cacheRef.current.clear();
  }, []);

  const getCacheSize = useCallback(() => {
    return cacheRef.current.size;
  }, []);

  return {
    getCachedPage,
    cachePage,
    clearCache,
    getCacheSize,
  };
}
