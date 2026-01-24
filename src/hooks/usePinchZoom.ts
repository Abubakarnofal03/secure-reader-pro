import { useCallback, useState, RefObject } from 'react';

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  scrollContainerRef?: RefObject<HTMLElement>;
}

/**
 * Hook for controlling zoom level in the PDF reader.
 * Uses width-based zoom (re-renders pages at different sizes) instead of CSS transforms.
 * This ensures the virtualizer works correctly and text stays crisp.
 * 
 * When scrollContainerRef is provided, zoom operations preserve scroll position
 * by adjusting scroll offset proportionally to the zoom change.
 */
export function usePinchZoom({
  minScale = 1,
  maxScale = 2,
  scrollContainerRef,
}: UsePinchZoomOptions = {}) {
  const [zoomLevel, setZoomLevel] = useState(1);

  // Zoom while preserving scroll position
  const zoomWithScrollPreservation = useCallback((newZoomLevel: number, prevZoomLevel: number) => {
    const container = scrollContainerRef?.current;
    if (!container) return;

    // Calculate scroll position ratio before zoom
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight - container.clientHeight;
    const scrollRatio = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    
    // Calculate horizontal scroll ratio
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth - container.clientWidth;
    const scrollRatioX = scrollWidth > 0 ? scrollLeft / scrollWidth : 0;

    // Apply zoom after a small delay to let re-render happen
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const newScrollHeight = container.scrollHeight - container.clientHeight;
        const newScrollWidth = container.scrollWidth - container.clientWidth;
        
        // Restore scroll position proportionally
        if (newScrollHeight > 0) {
          container.scrollTop = scrollRatio * newScrollHeight;
        }
        if (newScrollWidth > 0) {
          container.scrollLeft = scrollRatioX * newScrollWidth;
        }
      });
    });
  }, [scrollContainerRef]);

  const zoomIn = useCallback(() => {
    setZoomLevel(prev => {
      const next = Math.min(maxScale, Math.round((prev + 0.25) * 100) / 100);
      if (next !== prev) {
        zoomWithScrollPreservation(next, prev);
      }
      return next;
    });
  }, [maxScale, zoomWithScrollPreservation]);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const next = Math.max(minScale, Math.round((prev - 0.25) * 100) / 100);
      if (next !== prev) {
        zoomWithScrollPreservation(next, prev);
      }
      return next;
    });
  }, [minScale, zoomWithScrollPreservation]);

  const resetZoom = useCallback(() => {
    setZoomLevel(prev => {
      if (prev !== 1) {
        zoomWithScrollPreservation(1, prev);
      }
      return 1;
    });
  }, [zoomWithScrollPreservation]);

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    isZoomed: zoomLevel > 1,
  };
}
