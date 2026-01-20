import { useRef, useCallback, useEffect, useState } from 'react';

// Safe check for Capacitor - avoids crashes when not available
const isNativePlatform = (): boolean => {
  try {
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      return (window as any).Capacitor.isNativePlatform?.() ?? false;
    }
    return false;
  } catch {
    return false;
  }
};

interface UsePinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  containerRef: React.RefObject<HTMLElement>;
  contentRef: React.RefObject<HTMLElement>;
}

interface TransformState {
  scale: number;
  translateX: number;
  translateY: number;
}

export function usePinchZoom({
  minScale = 0.5,
  maxScale = 4,
  containerRef,
  contentRef,
}: UsePinchZoomOptions) {
  const [transform, setTransform] = useState<TransformState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  const isNative = isNativePlatform();

  // Gesture state refs
  const initialPinch = useRef<{
    distance: number;
    scale: number;
    // Focal point in document coordinates (scroll + client position)
    focalX: number;
    focalY: number;
    scrollTop: number;
    scrollLeft: number;
    translateX: number;
    translateY: number;
  } | null>(null);

  const panStart = useRef<{
    x: number;
    y: number;
    translateX: number;
    translateY: number;
  } | null>(null);

  const lastTapTime = useRef<number>(0);
  const lastTapPosition = useRef<{ x: number; y: number } | null>(null);
  const isPinching = useRef(false);
  const isPanning = useRef(false);

  const getDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getCenter = useCallback((touches: TouchList): { x: number; y: number } => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  // Clamp horizontal translation to prevent panning beyond content bounds
  const clampTranslateX = useCallback((
    translateX: number,
    scale: number,
    containerWidth: number,
    contentWidth: number
  ): number => {
    const scaledWidth = contentWidth * scale;
    
    // If content fits in container, center it
    if (scaledWidth <= containerWidth) {
      return 0;
    }
    
    // Allow panning within scaled content bounds
    const maxX = (scaledWidth - containerWidth) / 2;
    return Math.max(-maxX, Math.min(maxX, translateX));
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Pinch start (two fingers)
    if (e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();
      isPinching.current = true;
      isPanning.current = false;
      panStart.current = null;
      
      const center = getCenter(e.touches);
      const containerRect = container.getBoundingClientRect();
      
      // Calculate focal point relative to container viewport
      const viewportX = center.x - containerRect.left;
      const viewportY = center.y - containerRect.top;
      
      initialPinch.current = {
        distance: getDistance(e.touches),
        scale: transform.scale,
        focalX: viewportX,
        focalY: viewportY,
        scrollTop: container.scrollTop,
        scrollLeft: container.scrollLeft,
        translateX: transform.translateX,
        translateY: transform.translateY,
      };
      return;
    }

    // Single finger - check for double tap or start panning
    if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];
      const tapPosition = { x: touch.clientX, y: touch.clientY };

      // Check for double tap
      if (lastTapPosition.current) {
        const timeDiff = now - lastTapTime.current;
        const dx = Math.abs(tapPosition.x - lastTapPosition.current.x);
        const dy = Math.abs(tapPosition.y - lastTapPosition.current.y);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (timeDiff < 300 && distance < 50) {
          e.preventDefault();
          e.stopPropagation();
          
          const containerRect = container.getBoundingClientRect();
          const viewportX = touch.clientX - containerRect.left;
          const viewportY = touch.clientY - containerRect.top;
          
          if (transform.scale > 1.1) {
            // Zoom out to 1 - reset everything
            setTransform({ scale: 1, translateX: 0, translateY: 0 });
          } else {
            // Zoom in to 2.5x centered on tap point
            const newScale = 2.5;
            const oldScale = transform.scale;
            
            // Calculate document position of tap (accounting for scroll + current transform)
            const docX = (container.scrollLeft + viewportX - transform.translateX) / oldScale;
            const docY = (container.scrollTop + viewportY - transform.translateY) / oldScale;
            
            // Calculate new scroll position to keep tap point in same viewport position
            const newScrollTop = docY * newScale - viewportY;
            const newScrollLeft = docX * newScale - viewportX;
            
            // Center horizontally with translateX
            const containerWidth = containerRect.width;
            const contentWidth = content.scrollWidth / oldScale;
            const newTranslateX = clampTranslateX(0, newScale, containerWidth, contentWidth);
            
            setTransform({ 
              scale: newScale, 
              translateX: newTranslateX, 
              translateY: 0 
            });
            
            // Adjust scroll after transform applies
            requestAnimationFrame(() => {
              container.scrollTop = Math.max(0, newScrollTop);
            });
          }
          
          lastTapTime.current = 0;
          lastTapPosition.current = null;
          return;
        }
      }

      lastTapTime.current = now;
      lastTapPosition.current = tapPosition;

      // Start panning if zoomed in
      if (transform.scale > 1) {
        isPanning.current = true;
        panStart.current = {
          x: touch.clientX,
          y: touch.clientY,
          translateX: transform.translateX,
          translateY: transform.translateY,
        };
      }
    }
  }, [containerRef, contentRef, transform, getDistance, getCenter, clampTranslateX]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Handle pinch zoom
    if (e.touches.length === 2 && initialPinch.current) {
      e.preventDefault();
      e.stopPropagation();
      
      const currentDistance = getDistance(e.touches);
      const scaleChange = currentDistance / initialPinch.current.distance;
      let newScale = initialPinch.current.scale * scaleChange;
      newScale = Math.max(minScale, Math.min(maxScale, newScale));
      
      const oldScale = initialPinch.current.scale;
      const { focalX, focalY, scrollTop, scrollLeft, translateX: oldTranslateX } = initialPinch.current;
      
      // Calculate document position of focal point at initial scale
      const docX = (scrollLeft + focalX - oldTranslateX) / oldScale;
      const docY = (scrollTop + focalY) / oldScale;
      
      // Calculate new scroll position to keep focal point stationary
      const newScrollTop = docY * newScale - focalY;
      const newScrollLeft = docX * newScale - focalX;
      
      // Update horizontal centering
      const containerRect = container.getBoundingClientRect();
      const contentWidth = content.scrollWidth / transform.scale;
      const newTranslateX = clampTranslateX(0, newScale, containerRect.width, contentWidth);
      
      setTransform({
        scale: newScale,
        translateX: newTranslateX,
        translateY: 0,
      });
      
      // Adjust scroll to keep focal point in place
      container.scrollTop = Math.max(0, newScrollTop);
      
      return;
    }
    
    // Handle single finger pan when zoomed in (horizontal panning only, vertical is natural scroll)
    if (e.touches.length === 1 && isPanning.current && panStart.current && transform.scale > 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - panStart.current.x;
      
      const containerRect = container.getBoundingClientRect();
      const contentWidth = content.scrollWidth / transform.scale;
      
      const newTranslateX = clampTranslateX(
        panStart.current.translateX + deltaX,
        transform.scale,
        containerRect.width,
        contentWidth
      );
      
      setTransform(prev => ({
        ...prev,
        translateX: newTranslateX,
      }));
    }
  }, [containerRef, contentRef, transform.scale, getDistance, minScale, maxScale, clampTranslateX]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinch.current = null;
      isPinching.current = false;
    }
    
    if (e.touches.length === 0) {
      isPanning.current = false;
      panStart.current = null;
    }
    
    // If a touch just ended while we were pinching and there's still one finger,
    // start panning mode if zoomed in
    if (e.touches.length === 1 && transform.scale > 1) {
      const touch = e.touches[0];
      isPanning.current = true;
      panStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        translateX: transform.translateX,
        translateY: transform.translateY,
      };
    }
  }, [transform]);

  const handleTouchCancel = useCallback(() => {
    initialPinch.current = null;
    isPinching.current = false;
    isPanning.current = false;
    panStart.current = null;
  }, []);

  // Handle wheel zoom for desktop/web
  const handleWheel = useCallback((e: WheelEvent) => {
    // Only handle Ctrl/Cmd + wheel for zoom
    if (!e.ctrlKey && !e.metaKey) return;
    
    e.preventDefault();
    
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    
    const containerRect = container.getBoundingClientRect();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    let newScale = transform.scale * delta;
    newScale = Math.max(minScale, Math.min(maxScale, newScale));
    
    const oldScale = transform.scale;
    
    // Focal point in viewport
    const viewportX = e.clientX - containerRect.left;
    const viewportY = e.clientY - containerRect.top;
    
    // Calculate document position of focal point
    const docX = (container.scrollLeft + viewportX - transform.translateX) / oldScale;
    const docY = (container.scrollTop + viewportY) / oldScale;
    
    // Calculate new scroll to keep focal point stationary
    const newScrollTop = docY * newScale - viewportY;
    
    const contentWidth = content.scrollWidth / oldScale;
    const newTranslateX = clampTranslateX(0, newScale, containerRect.width, contentWidth);
    
    setTransform({
      scale: newScale,
      translateX: newTranslateX,
      translateY: 0,
    });
    
    container.scrollTop = Math.max(0, newScrollTop);
  }, [containerRef, contentRef, transform, minScale, maxScale, clampTranslateX]);

  // Prevent default gestures on native platforms
  useEffect(() => {
    if (!isNative) return;

    const preventGesture = (e: Event) => e.preventDefault();
    
    document.addEventListener('gesturestart', preventGesture);
    document.addEventListener('gesturechange', preventGesture);
    document.addEventListener('gestureend', preventGesture);
    
    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
    };
  }, [isNative]);

  // Attach event listeners to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options: AddEventListenerOptions = { passive: false, capture: true };
    
    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, options);
    container.addEventListener('touchcancel', handleTouchCancel, options);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart, options);
      container.removeEventListener('touchmove', handleTouchMove, options);
      container.removeEventListener('touchend', handleTouchEnd, options);
      container.removeEventListener('touchcancel', handleTouchCancel, options);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, handleWheel]);

  const resetZoom = useCallback(() => {
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    
    const oldScale = transform.scale;
    const newScale = Math.min(maxScale, oldScale * 1.25);
    
    const containerRect = container.getBoundingClientRect();
    
    // Zoom centered on viewport center
    const viewportCenterY = containerRect.height / 2;
    
    // Document position of viewport center
    const docY = (container.scrollTop + viewportCenterY) / oldScale;
    
    // New scroll to keep center in place
    const newScrollTop = docY * newScale - viewportCenterY;
    
    const contentWidth = content.scrollWidth / oldScale;
    const newTranslateX = clampTranslateX(0, newScale, containerRect.width, contentWidth);
    
    setTransform({
      scale: newScale,
      translateX: newTranslateX,
      translateY: 0,
    });
    
    requestAnimationFrame(() => {
      container.scrollTop = Math.max(0, newScrollTop);
    });
  }, [maxScale, containerRef, contentRef, transform.scale, clampTranslateX]);

  const zoomOut = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    
    const oldScale = transform.scale;
    const newScale = Math.max(minScale, oldScale / 1.25);
    
    // Reset translate when zooming back to 1 or below
    if (newScale <= 1) {
      setTransform({ scale: newScale, translateX: 0, translateY: 0 });
      return;
    }
    
    const containerRect = container.getBoundingClientRect();
    
    // Zoom centered on viewport center
    const viewportCenterY = containerRect.height / 2;
    
    // Document position of viewport center
    const docY = (container.scrollTop + viewportCenterY) / oldScale;
    
    // New scroll to keep center in place
    const newScrollTop = docY * newScale - viewportCenterY;
    
    const contentWidth = content.scrollWidth / oldScale;
    const newTranslateX = clampTranslateX(0, newScale, containerRect.width, contentWidth);
    
    setTransform({
      scale: newScale,
      translateX: newTranslateX,
      translateY: 0,
    });
    
    requestAnimationFrame(() => {
      container.scrollTop = Math.max(0, newScrollTop);
    });
  }, [minScale, containerRef, contentRef, transform.scale, clampTranslateX]);

  return {
    transform,
    zoomIn,
    zoomOut,
    resetZoom,
    scale: transform.scale,
    isZoomed: transform.scale > 1,
  };
}
