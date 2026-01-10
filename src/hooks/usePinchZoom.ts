import { useRef, useCallback, useEffect } from 'react';

interface PinchZoomState {
  initialDistance: number;
  initialZoomIndex: number;
}

interface UsePinchZoomOptions {
  zoomLevels: number[];
  zoomIndex: number;
  onZoomChange: (newIndex: number) => void;
  containerRef: React.RefObject<HTMLElement>;
}

export function usePinchZoom({
  zoomLevels,
  zoomIndex,
  onZoomChange,
  containerRef,
}: UsePinchZoomOptions) {
  const pinchState = useRef<PinchZoomState | null>(null);
  const lastTapTime = useRef<number>(0);
  const lastTapPosition = useRef<{ x: number; y: number } | null>(null);

  const getDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      // Handle pinch start (two fingers)
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchState.current = {
          initialDistance: getDistance(e.touches),
          initialZoomIndex: zoomIndex,
        };
      }

      // Handle double-tap detection (single finger)
      if (e.touches.length === 1) {
        const now = Date.now();
        const touch = e.touches[0];
        const tapPosition = { x: touch.clientX, y: touch.clientY };

        // Check if this is a double-tap (within 300ms and 50px of last tap)
        if (lastTapPosition.current) {
          const timeDiff = now - lastTapTime.current;
          const dx = Math.abs(tapPosition.x - lastTapPosition.current.x);
          const dy = Math.abs(tapPosition.y - lastTapPosition.current.y);
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (timeDiff < 300 && distance < 50) {
            e.preventDefault();
            // Toggle between 100% (index 2) and 200% (index 6) or closest
            const zoomIndex100 = zoomLevels.findIndex((z) => z === 1);
            const zoomIndex200 = zoomLevels.findIndex((z) => z === 2);
            
            if (zoomIndex <= zoomIndex100) {
              onZoomChange(zoomIndex200 >= 0 ? zoomIndex200 : zoomLevels.length - 1);
            } else {
              onZoomChange(zoomIndex100 >= 0 ? zoomIndex100 : 0);
            }
            
            lastTapTime.current = 0;
            lastTapPosition.current = null;
            return;
          }
        }

        lastTapTime.current = now;
        lastTapPosition.current = tapPosition;
      }
    },
    [getDistance, zoomIndex, zoomLevels, onZoomChange]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchState.current) {
        e.preventDefault();
        
        const currentDistance = getDistance(e.touches);
        const scale = currentDistance / pinchState.current.initialDistance;
        
        // Calculate new zoom level based on scale
        const scaledZoom = zoomLevels[pinchState.current.initialZoomIndex] * scale;
        
        // Find the closest zoom level
        let closestIndex = 0;
        let closestDiff = Math.abs(zoomLevels[0] - scaledZoom);
        
        for (let i = 1; i < zoomLevels.length; i++) {
          const diff = Math.abs(zoomLevels[i] - scaledZoom);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestIndex = i;
          }
        }
        
        if (closestIndex !== zoomIndex) {
          onZoomChange(closestIndex);
        }
      }
    },
    [getDistance, zoomLevels, zoomIndex, onZoomChange]
  );

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length < 2) {
      pinchState.current = null;
    }
  }, []);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    // Expose for manual control if needed
    resetPinchState: () => {
      pinchState.current = null;
    },
  };
}
