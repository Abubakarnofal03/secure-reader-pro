import { useCallback, useState } from 'react';

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
}

/**
 * Hook for controlling zoom level in the PDF reader.
 * Uses width-based zoom (re-renders pages at different sizes) instead of CSS transforms.
 * This ensures the virtualizer works correctly and text stays crisp.
 */
export function usePinchZoom({
  minScale = 1,
  maxScale = 2,
}: UsePinchZoomOptions = {}) {
  const [zoomLevel, setZoomLevel] = useState(1);

  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(maxScale, Math.round((prev + 0.25) * 100) / 100));
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(minScale, Math.round((prev - 0.25) * 100) / 100));
  }, [minScale]);

  const resetZoom = useCallback(() => setZoomLevel(1), []);

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    isZoomed: zoomLevel > 1,
  };
}
