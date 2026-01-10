import { useRef, useCallback, useEffect } from 'react';

interface PinchZoomState {
  initialDistance: number;
  initialZoomIndex: number;
  centerX: number;
  centerY: number;
  scrollLeft: number;
  scrollTop: number;
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

  const getPinchCenter = useCallback((touches: TouchList): { x: number; y: number } => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Get the scrollable parent (the <main> element)
      const scrollParent = container.closest('main') || container.parentElement;

      // Handle pinch start (two fingers)
      if (e.touches.length === 2) {
        e.preventDefault();
        const center = getPinchCenter(e.touches);
        const rect = container.getBoundingClientRect();
        
        pinchState.current = {
          initialDistance: getDistance(e.touches),
          initialZoomIndex: zoomIndex,
          // Store center position relative to container
          centerX: center.x - rect.left + (scrollParent?.scrollLeft || 0),
          centerY: center.y - rect.top + (scrollParent?.scrollTop || 0),
          scrollLeft: scrollParent?.scrollLeft || 0,
          scrollTop: scrollParent?.scrollTop || 0,
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
            
            const rect = container.getBoundingClientRect();
            const tapX = touch.clientX - rect.left + (scrollParent?.scrollLeft || 0);
            const tapY = touch.clientY - rect.top + (scrollParent?.scrollTop || 0);
            
            // Toggle between 100% (index 2) and 200% (index 6) or closest
            const zoomIndex100 = zoomLevels.findIndex((z) => z === 1);
            const zoomIndex200 = zoomLevels.findIndex((z) => z === 2);
            
            const oldZoom = zoomLevels[zoomIndex];
            let newZoomIndex: number;
            
            if (zoomIndex <= zoomIndex100) {
              newZoomIndex = zoomIndex200 >= 0 ? zoomIndex200 : zoomLevels.length - 1;
            } else {
              newZoomIndex = zoomIndex100 >= 0 ? zoomIndex100 : 0;
            }
            
            const newZoom = zoomLevels[newZoomIndex];
            const scale = newZoom / oldZoom;
            
            onZoomChange(newZoomIndex);
            
            // Scroll to keep tap position centered after zoom
            requestAnimationFrame(() => {
              if (scrollParent) {
                const newScrollX = tapX * scale - (touch.clientX - rect.left);
                const newScrollY = tapY * scale - (touch.clientY - rect.top);
                scrollParent.scrollLeft = Math.max(0, newScrollX);
                scrollParent.scrollTop = Math.max(0, newScrollY);
              }
            });
            
            lastTapTime.current = 0;
            lastTapPosition.current = null;
            return;
          }
        }

        lastTapTime.current = now;
        lastTapPosition.current = tapPosition;
      }
    },
    [getDistance, getPinchCenter, zoomIndex, zoomLevels, onZoomChange, containerRef]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const container = containerRef.current;
      if (!container) return;
      
      const scrollParent = container.closest('main') || container.parentElement;

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
          const oldZoom = zoomLevels[zoomIndex];
          const newZoom = zoomLevels[closestIndex];
          const zoomScale = newZoom / oldZoom;
          
          onZoomChange(closestIndex);
          
          // Adjust scroll position to keep pinch center in place
          if (scrollParent && pinchState.current) {
            const center = getPinchCenter(e.touches);
            const rect = container.getBoundingClientRect();
            
            // Calculate where the pinch center should be after zoom
            const newCenterX = pinchState.current.centerX * (newZoom / zoomLevels[pinchState.current.initialZoomIndex]);
            const newCenterY = pinchState.current.centerY * (newZoom / zoomLevels[pinchState.current.initialZoomIndex]);
            
            // Scroll to keep the pinch center at the same screen position
            const newScrollX = newCenterX - (center.x - rect.left);
            const newScrollY = newCenterY - (center.y - rect.top);
            
            scrollParent.scrollLeft = Math.max(0, newScrollX);
            scrollParent.scrollTop = Math.max(0, newScrollY);
          }
        }
      }
    },
    [getDistance, getPinchCenter, zoomLevels, zoomIndex, onZoomChange, containerRef]
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
