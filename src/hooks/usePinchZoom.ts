import { useRef, useCallback, useEffect, useState } from 'react';

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  containerRef: React.RefObject<HTMLElement>;
  scrollContainerRef?: React.RefObject<HTMLElement>;
}

interface PinchZoomState {
  // The committed scale (used for rendering pages)
  committedScale: number;
  // The gesture scale during pinch (relative multiplier)
  gestureScale: number;
  // Whether we're currently pinching
  isGesturing: boolean;
}

export function usePinchZoom({
  minScale = 1,
  maxScale = 2,
  containerRef,
  scrollContainerRef,
}: UsePinchZoomOptions) {
  const [state, setState] = useState<PinchZoomState>({
    committedScale: 1,
    gestureScale: 1,
    isGesturing: false,
  });

  // Gesture tracking refs (don't cause re-renders)
  const gestureRef = useRef<{
    initialDistance: number;
    initialScale: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  // Track gesture scale without re-renders during pinch
  const liveGestureScale = useRef(1);
  const rafId = useRef<number | null>(null);

  // Get distance between two touch points
  const getDistance = useCallback((t1: Touch, t2: Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Get center point between two touches
  const getCenter = useCallback((t1: Touch, t2: Touch) => {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  }, []);

  // Preserve scroll position around focal point when scale changes
  const preserveScrollPosition = useCallback((
    scrollEl: HTMLElement,
    oldScale: number,
    newScale: number,
    focalX: number,
    focalY: number
  ) => {
    // Calculate the scroll position relative to the focal point
    const scrollLeft = scrollEl.scrollLeft;
    const scrollTop = scrollEl.scrollTop;
    
    // Where in the document was the focal point?
    const docX = (scrollLeft + focalX) / oldScale;
    const docY = (scrollTop + focalY) / oldScale;
    
    // Calculate new scroll position to keep focal point in place
    const newScrollLeft = docX * newScale - focalX;
    const newScrollTop = docY * newScale - focalY;
    
    scrollEl.scrollLeft = Math.max(0, newScrollLeft);
    scrollEl.scrollTop = Math.max(0, newScrollTop);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Prevent default browser behavior (pull-to-refresh, etc.)
      e.preventDefault();
      e.stopPropagation();
      
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const center = getCenter(t1, t2);
      
      gestureRef.current = {
        initialDistance: getDistance(t1, t2),
        initialScale: state.committedScale,
        centerX: center.x,
        centerY: center.y,
      };
      
      liveGestureScale.current = 1;
      
      // Set touch-action to none on the container during gesture
      const container = containerRef.current;
      if (container) {
        container.style.touchAction = 'none';
      }
      
      setState(prev => ({ ...prev, isGesturing: true, gestureScale: 1 }));
    }
  }, [state.committedScale, getDistance, getCenter, containerRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 2 || !gestureRef.current) return;
    
    // Prevent default to stop browser zoom/scroll
    e.preventDefault();
    e.stopPropagation();
    
    const currentDistance = getDistance(e.touches[0], e.touches[1]);
    const scaleRatio = currentDistance / gestureRef.current.initialDistance;
    
    // Calculate what the final scale would be
    const potentialScale = gestureRef.current.initialScale * scaleRatio;
    
    // Clamp to min/max
    const clampedScale = Math.max(minScale, Math.min(maxScale, potentialScale));
    
    // Calculate gesture scale relative to committed scale
    const gestureScale = clampedScale / gestureRef.current.initialScale;
    
    liveGestureScale.current = gestureScale;
    
    // Use RAF to batch updates
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        setState(prev => ({
          ...prev,
          gestureScale: liveGestureScale.current,
        }));
        rafId.current = null;
      });
    }
  }, [getDistance, minScale, maxScale]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Restore touch-action on the container
    const container = containerRef.current;
    if (container) {
      container.style.touchAction = '';
    }
    
    if (e.touches.length === 0 && gestureRef.current) {
      // Cancel any pending RAF
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      
      // Calculate final committed scale
      const finalScale = Math.max(
        minScale,
        Math.min(maxScale, gestureRef.current.initialScale * liveGestureScale.current)
      );
      
      // Round to avoid floating point issues
      const roundedScale = Math.round(finalScale * 100) / 100;
      
      // Get scroll container for position preservation
      const scrollEl = scrollContainerRef?.current || containerRef.current;
      
      if (scrollEl && roundedScale !== gestureRef.current.initialScale) {
        // Preserve scroll position around the gesture center
        const rect = scrollEl.getBoundingClientRect();
        const focalX = gestureRef.current.centerX - rect.left;
        const focalY = gestureRef.current.centerY - rect.top;
        
        // Use requestAnimationFrame to ensure scroll happens after render
        requestAnimationFrame(() => {
          preserveScrollPosition(
            scrollEl,
            gestureRef.current!.initialScale,
            roundedScale,
            focalX,
            focalY
          );
        });
      }
      
      gestureRef.current = null;
      liveGestureScale.current = 1;
      
      setState({
        committedScale: roundedScale,
        gestureScale: 1,
        isGesturing: false,
      });
    }
    
    // Handle case where one finger is lifted during pinch
    if (e.touches.length === 1 && gestureRef.current) {
      gestureRef.current = null;
      liveGestureScale.current = 1;
      setState(prev => ({ ...prev, isGesturing: false, gestureScale: 1 }));
    }
  }, [minScale, maxScale, containerRef, scrollContainerRef, preserveScrollPosition]);

  const handleTouchCancel = useCallback(() => {
    // Restore touch-action on the container
    const container = containerRef.current;
    if (container) {
      container.style.touchAction = '';
    }
    
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    gestureRef.current = null;
    liveGestureScale.current = 1;
    setState(prev => ({ ...prev, isGesturing: false, gestureScale: 1 }));
  }, [containerRef]);

  // Mouse wheel zoom (Ctrl/Cmd + scroll) for desktop
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    const scrollEl = scrollContainerRef?.current || containerRef.current;
    const oldScale = state.committedScale;
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    let newScale = oldScale * delta;
    newScale = Math.max(minScale, Math.min(maxScale, newScale));
    newScale = Math.round(newScale * 100) / 100;
    
    if (newScale !== oldScale && scrollEl) {
      const rect = scrollEl.getBoundingClientRect();
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;
      
      setState(prev => ({ ...prev, committedScale: newScale }));
      
      requestAnimationFrame(() => {
        preserveScrollPosition(scrollEl, oldScale, newScale, focalX, focalY);
      });
    }
  }, [state.committedScale, minScale, maxScale, containerRef, scrollContainerRef, preserveScrollPosition]);

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
      
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, handleWheel]);

  const resetZoom = useCallback(() => {
    setState({
      committedScale: 1,
      gestureScale: 1,
      isGesturing: false,
    });
  }, []);

  const zoomIn = useCallback(() => {
    setState(prev => {
      const newScale = Math.min(maxScale, prev.committedScale * 1.25);
      return { ...prev, committedScale: Math.round(newScale * 100) / 100 };
    });
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setState(prev => {
      const newScale = Math.max(minScale, prev.committedScale / 1.25);
      return { ...prev, committedScale: Math.round(newScale * 100) / 100 };
    });
  }, [minScale]);

  // Calculate the effective visual scale (committed * gesture)
  const visualScale = state.committedScale * state.gestureScale;
  
  // CSS transform for gesture feedback (only during pinch)
  const gestureTransform = state.isGesturing && state.gestureScale !== 1
    ? `scale(${state.gestureScale})`
    : undefined;

  return {
    // The scale to render pages at (only changes on gesture end)
    scale: state.committedScale,
    // The visual scale during gesture (for display purposes)
    visualScale,
    // CSS transform to apply during gesture
    gestureTransform,
    // Whether currently gesturing
    isGesturing: state.isGesturing,
    // Actions
    zoomIn,
    zoomOut,
    resetZoom,
    // Whether zoomed beyond 1x
    isZoomed: state.committedScale > 1,
  };
}
