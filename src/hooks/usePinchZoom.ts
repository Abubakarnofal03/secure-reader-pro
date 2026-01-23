import { useCallback, useState } from 'react';

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
}

export function usePinchZoom({
  minScale = 1,
  maxScale = 2,
}: UsePinchZoomOptions = {}) {
  const [scale, setScale] = useState(1);

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(maxScale, Math.round((prev + 0.25) * 100) / 100));
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(minScale, Math.round((prev - 0.25) * 100) / 100));
  }, [minScale]);

  const resetZoom = useCallback(() => setScale(1), []);

  return {
    scale,
    zoomIn,
    zoomOut,
    resetZoom,
    isZoomed: scale > 1,
  };
}
