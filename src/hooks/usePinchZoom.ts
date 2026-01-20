import { useRef, useCallback, useEffect, useState } from 'react';

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  containerRef: React.RefObject<HTMLElement>;
}

export function usePinchZoom({
  minScale = 1,
  maxScale = 2,
  containerRef,
}: UsePinchZoomOptions) {
  const [scale, setScale] = useState(1);
  
  // Pending scale during gesture (for debounced updates)
  const pendingScale = useRef(1);
  const updateTimer = useRef<number | null>(null);

  // Gesture state refs
  const gestureState = useRef<{
    initialDistance: number;
    initialScale: number;
  } | null>(null);

  const isGesturing = useRef(false);

  const getDistance = useCallback((t1: Touch, t2: Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Debounced scale update to prevent excessive re-renders during pinch
  const scheduleScaleUpdate = useCallback((newScale: number) => {
    pendingScale.current = newScale;
    
    if (updateTimer.current !== null) {
      cancelAnimationFrame(updateTimer.current);
    }
    
    updateTimer.current = requestAnimationFrame(() => {
      setScale(pendingScale.current);
      updateTimer.current = null;
    });
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Two-finger pinch start
    if (e.touches.length === 2) {
      e.preventDefault();
      isGesturing.current = true;

      const t1 = e.touches[0];
      const t2 = e.touches[1];

      gestureState.current = {
        initialDistance: getDistance(t1, t2),
        initialScale: scale,
      };
    }
    // No double-tap handling - disabled per user request
  }, [scale, getDistance]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const gesture = gestureState.current;

    // Only handle pinch zoom with 2 fingers
    if (e.touches.length !== 2 || !gesture) return;

    e.preventDefault();
    isGesturing.current = true;

    const currentDistance = getDistance(e.touches[0], e.touches[1]);
    const scaleRatio = currentDistance / gesture.initialDistance;
    let newScale = gesture.initialScale * scaleRatio;
    newScale = Math.max(minScale, Math.min(maxScale, newScale));

    // Round to avoid excessive precision
    newScale = Math.round(newScale * 100) / 100;

    scheduleScaleUpdate(newScale);
  }, [getDistance, minScale, maxScale, scheduleScaleUpdate]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length === 0) {
      gestureState.current = null;
      isGesturing.current = false;
      
      // Ensure final scale is applied
      if (updateTimer.current !== null) {
        cancelAnimationFrame(updateTimer.current);
        updateTimer.current = null;
        setScale(pendingScale.current);
      }
    }

    // If still have one finger remaining from a pinch, clear gesture
    if (e.touches.length === 1 && gestureState.current) {
      gestureState.current = null;
    }
  }, []);

  const handleTouchCancel = useCallback(() => {
    gestureState.current = null;
    isGesturing.current = false;
    
    if (updateTimer.current !== null) {
      cancelAnimationFrame(updateTimer.current);
      updateTimer.current = null;
    }
  }, []);

  // Mouse wheel zoom (desktop) - Ctrl/Cmd + scroll
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => {
      let newScale = prev * delta;
      newScale = Math.max(minScale, Math.min(maxScale, newScale));
      return Math.round(newScale * 100) / 100;
    });
  }, [minScale, maxScale]);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const touchOptions: AddEventListenerOptions = { passive: false };

    container.addEventListener('touchstart', handleTouchStart, touchOptions);
    container.addEventListener('touchmove', handleTouchMove, touchOptions);
    container.addEventListener('touchend', handleTouchEnd, touchOptions);
    container.addEventListener('touchcancel', handleTouchCancel, touchOptions);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
      container.removeEventListener('wheel', handleWheel);
      
      if (updateTimer.current !== null) {
        cancelAnimationFrame(updateTimer.current);
      }
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, handleWheel]);

  const resetZoom = useCallback(() => {
    setScale(1);
  }, []);

  const zoomIn = useCallback(() => {
    setScale(prev => {
      const newScale = Math.min(maxScale, prev * 1.25);
      return Math.round(newScale * 100) / 100;
    });
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = Math.max(minScale, prev / 1.25);
      return Math.round(newScale * 100) / 100;
    });
  }, [minScale]);

  return {
    scale,
    zoomIn,
    zoomOut,
    resetZoom,
    isZoomed: scale > 1,
  };
}
