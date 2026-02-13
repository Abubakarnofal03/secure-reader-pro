import { useCallback, useState, useRef, useEffect } from 'react';

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  /** Current page number to restore after zoom */
  currentPage?: number;
  /** Callback to scroll to a specific page after zoom */
  onZoomChange?: (newZoom: number, pageToRestore: number) => void;
}

/**
 * Hook for controlling zoom level in the PDF reader.
 * Uses width-based zoom (re-renders pages at different sizes) instead of CSS transforms.
 * This ensures the virtualizer works correctly and text stays crisp.
 * 
 * After zoom, calls onZoomChange with the page to restore so the parent
 * can use the virtualizer's scrollToIndex for accurate positioning.
 */
export function usePinchZoom({
  minScale = 1,
  maxScale = 2,
  currentPage = 1,
  onZoomChange,
}: UsePinchZoomOptions = {}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Track the page at zoom start so we can restore it after re-render
  const pageAtZoomRef = useRef(currentPage);
  
  // Keep ref updated with current page
  useEffect(() => {
    pageAtZoomRef.current = currentPage;
  }, [currentPage]);

  const zoomIn = useCallback(() => {
    const pageToRestore = pageAtZoomRef.current;
    setZoomLevel(prev => {
      const next = Math.min(maxScale, Math.round((prev + 0.25) * 100) / 100);
      if (next !== prev) {
        // Notify parent to restore page after re-render
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            onZoomChange?.(next, pageToRestore);
          });
        });
      }
      return next;
    });
  }, [maxScale, onZoomChange]);

  const zoomOut = useCallback(() => {
    const pageToRestore = pageAtZoomRef.current;
    setZoomLevel(prev => {
      const next = Math.max(minScale, Math.round((prev - 0.25) * 100) / 100);
      if (next !== prev) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            onZoomChange?.(next, pageToRestore);
          });
        });
      }
      return next;
    });
  }, [minScale, onZoomChange]);

  const resetZoom = useCallback(() => {
    const pageToRestore = pageAtZoomRef.current;
    setZoomLevel(prev => {
      if (prev !== 1) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            onZoomChange?.(1, pageToRestore);
          });
        });
      }
      return 1;
    });
  }, [onZoomChange]);

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    isZoomed: zoomLevel > 1,
  };
}
