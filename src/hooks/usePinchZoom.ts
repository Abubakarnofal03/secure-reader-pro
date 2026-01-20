import { useRef, useCallback, useEffect, useState } from 'react';

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  containerRef: React.RefObject<HTMLElement>;
  contentRef: React.RefObject<HTMLElement>;
}

interface TransformState {
  scale: number;
  translateX: number;
}

export function usePinchZoom({
  minScale = 1,
  maxScale = 3,
  containerRef,
  contentRef,
}: UsePinchZoomOptions) {
  const [transform, setTransform] = useState<TransformState>({
    scale: 1,
    translateX: 0,
  });

  // Gesture state refs - only track what we need
  const gestureState = useRef<{
    initialDistance: number;
    initialScale: number;
    initialScrollTop: number;
    focalPointY: number; // Y position in viewport at gesture start
    focalDocY: number; // Document Y coordinate of focal point
  } | null>(null);

  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const isGesturing = useRef(false);

  const getDistance = useCallback((t1: Touch, t2: Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;

    // Two-finger pinch start
    if (e.touches.length === 2) {
      e.preventDefault();
      isGesturing.current = true;

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const centerY = (t1.clientY + t2.clientY) / 2;
      const containerRect = container.getBoundingClientRect();
      const viewportY = centerY - containerRect.top;

      // Calculate document coordinate of focal point
      const docY = (container.scrollTop + viewportY) / transform.scale;

      gestureState.current = {
        initialDistance: getDistance(t1, t2),
        initialScale: transform.scale,
        initialScrollTop: container.scrollTop,
        focalPointY: viewportY,
        focalDocY: docY,
      };
      return;
    }

    // Single tap - check for double tap
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();

      if (lastTap.current) {
        const timeDiff = now - lastTap.current.time;
        const dx = Math.abs(touch.clientX - lastTap.current.x);
        const dy = Math.abs(touch.clientY - lastTap.current.y);

        // Double tap detected
        if (timeDiff < 300 && dx < 50 && dy < 50) {
          e.preventDefault();

          if (transform.scale > 1.1) {
            // Reset to normal
            setTransform({ scale: 1, translateX: 0 });
          } else {
            // Zoom to 2x centered on tap
            const containerRect = container.getBoundingClientRect();
            const viewportY = touch.clientY - containerRect.top;
            const docY = (container.scrollTop + viewportY) / transform.scale;
            const newScale = 2;
            const newScrollTop = docY * newScale - viewportY;

            setTransform({ scale: newScale, translateX: 0 });
            requestAnimationFrame(() => {
              container.scrollTop = Math.max(0, newScrollTop);
            });
          }

          lastTap.current = null;
          return;
        }
      }

      lastTap.current = { time: now, x: touch.clientX, y: touch.clientY };
    }
  }, [containerRef, transform.scale, getDistance]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    const gesture = gestureState.current;

    // Only handle pinch zoom with 2 fingers
    if (e.touches.length !== 2 || !gesture || !container) return;

    e.preventDefault();
    isGesturing.current = true;

    const currentDistance = getDistance(e.touches[0], e.touches[1]);
    const scaleRatio = currentDistance / gesture.initialDistance;
    let newScale = gesture.initialScale * scaleRatio;
    newScale = Math.max(minScale, Math.min(maxScale, newScale));

    // Keep focal point stationary
    const newScrollTop = gesture.focalDocY * newScale - gesture.focalPointY;

    setTransform({ scale: newScale, translateX: 0 });
    container.scrollTop = Math.max(0, newScrollTop);
  }, [containerRef, getDistance, minScale, maxScale]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length === 0) {
      gestureState.current = null;
      isGesturing.current = false;
    }

    // If still have one finger remaining from a pinch, update gesture state
    if (e.touches.length === 1 && gestureState.current) {
      gestureState.current = null;
    }
  }, []);

  const handleTouchCancel = useCallback(() => {
    gestureState.current = null;
    isGesturing.current = false;
  }, []);

  // Mouse wheel zoom (desktop)
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const viewportY = e.clientY - containerRect.top;
    const docY = (container.scrollTop + viewportY) / transform.scale;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    let newScale = transform.scale * delta;
    newScale = Math.max(minScale, Math.min(maxScale, newScale));

    const newScrollTop = docY * newScale - viewportY;

    setTransform({ scale: newScale, translateX: 0 });
    container.scrollTop = Math.max(0, newScrollTop);
  }, [containerRef, transform.scale, minScale, maxScale]);

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
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, handleWheel]);

  const resetZoom = useCallback(() => {
    setTransform({ scale: 1, translateX: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const oldScale = transform.scale;
    const newScale = Math.min(maxScale, oldScale * 1.25);
    
    // Keep viewport center stable
    const containerRect = container.getBoundingClientRect();
    const viewportCenterY = containerRect.height / 2;
    const docY = (container.scrollTop + viewportCenterY) / oldScale;
    const newScrollTop = docY * newScale - viewportCenterY;

    setTransform({ scale: newScale, translateX: 0 });
    requestAnimationFrame(() => {
      container.scrollTop = Math.max(0, newScrollTop);
    });
  }, [containerRef, transform.scale, maxScale]);

  const zoomOut = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const oldScale = transform.scale;
    const newScale = Math.max(minScale, oldScale / 1.25);

    if (newScale <= 1) {
      setTransform({ scale: 1, translateX: 0 });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const viewportCenterY = containerRect.height / 2;
    const docY = (container.scrollTop + viewportCenterY) / oldScale;
    const newScrollTop = docY * newScale - viewportCenterY;

    setTransform({ scale: newScale, translateX: 0 });
    requestAnimationFrame(() => {
      container.scrollTop = Math.max(0, newScrollTop);
    });
  }, [containerRef, transform.scale, minScale]);

  return {
    transform,
    zoomIn,
    zoomOut,
    resetZoom,
    scale: transform.scale,
    isZoomed: transform.scale > 1,
  };
}
