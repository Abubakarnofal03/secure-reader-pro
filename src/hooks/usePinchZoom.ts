import { useRef, useCallback, useEffect, useState } from 'react';

// Safe check for Capacitor - avoids crashes when not available
const isNativePlatform = (): boolean => {
  try {
    // Dynamic import check for Capacitor
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

  // Track if we're on a native platform
  const isNative = isNativePlatform();

  // Gesture state refs
  const initialPinch = useRef<{
    distance: number;
    scale: number;
    centerX: number;
    centerY: number;
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

  // Store initial content dimensions once set
  const initialContentSize = useRef<{ width: number; height: number } | null>(null);
  const contentInitialized = useRef(false);

  // Initialize content size on mount/content change
  useEffect(() => {
    const content = contentRef.current;
    if (!content || contentInitialized.current) return;
    
    const initContentSize = () => {
      const rect = content.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        initialContentSize.current = {
          width: rect.width,
          height: rect.height,
        };
        contentInitialized.current = true;
      }
    };
    
    // Try immediately
    initContentSize();
    
    // Also observe for changes if not ready yet
    if (!contentInitialized.current) {
      const observer = new ResizeObserver(() => {
        if (!contentInitialized.current) {
          initContentSize();
        }
      });
      observer.observe(content);
      return () => observer.disconnect();
    }
  }, [contentRef]);

  const clampTransform = useCallback((
    newTransform: TransformState, 
    containerRect: DOMRect, 
    contentRect: DOMRect,
    currentScale: number = 1
  ): TransformState => {
    const { scale, translateX, translateY } = newTransform;
    
    // Use stored initial dimensions or calculate from current
    const originalWidth = initialContentSize.current?.width ?? contentRect.width / Math.max(currentScale, 1);
    const originalHeight = initialContentSize.current?.height ?? contentRect.height / Math.max(currentScale, 1);
    
    const scaledWidth = originalWidth * scale;
    const scaledHeight = originalHeight * scale;
    
    let clampedX = translateX;
    let clampedY = translateY;
    
    // If content is smaller than or equal to container, center it
    if (scaledWidth <= containerRect.width) {
      clampedX = 0;
    } else {
      // Allow panning within the scaled content bounds
      const maxX = (scaledWidth - containerRect.width) / 2;
      clampedX = Math.max(-maxX, Math.min(maxX, translateX));
    }
    
    if (scaledHeight <= containerRect.height) {
      clampedY = 0;
    } else {
      const maxY = (scaledHeight - containerRect.height) / 2;
      clampedY = Math.max(-maxY, Math.min(maxY, translateY));
    }
    
    return { scale, translateX: clampedX, translateY: clampedY };
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
      
      initialPinch.current = {
        distance: getDistance(e.touches),
        scale: transform.scale,
        centerX: center.x - containerRect.left - containerRect.width / 2,
        centerY: center.y - containerRect.top - containerRect.height / 2,
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
          const contentRect = content.getBoundingClientRect();
          
          if (transform.scale > 1.1) {
            // Zoom out to 1
            setTransform({ scale: 1, translateX: 0, translateY: 0 });
          } else {
            // Zoom in to 2.5x centered on tap point
            const newScale = 2.5;
            const tapX = touch.clientX - containerRect.left - containerRect.width / 2;
            const tapY = touch.clientY - containerRect.top - containerRect.height / 2;
            
            // Calculate offset to zoom towards tap point
            const newTranslateX = -tapX * (newScale - 1);
            const newTranslateY = -tapY * (newScale - 1);
            
            const clamped = clampTransform(
              { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
              containerRect,
              contentRect,
              transform.scale
            );
            setTransform(clamped);
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
  }, [containerRef, contentRef, transform, getDistance, getCenter, clampTransform]);

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
      
      const center = getCenter(e.touches);
      const containerRect = container.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      
      const currentCenterX = center.x - containerRect.left - containerRect.width / 2;
      const currentCenterY = center.y - containerRect.top - containerRect.height / 2;
      
      // Calculate new translation to keep pinch center fixed
      const scaleDiff = newScale / initialPinch.current.scale;
      const newTranslateX = currentCenterX - (initialPinch.current.centerX - initialPinch.current.translateX) * scaleDiff;
      const newTranslateY = currentCenterY - (initialPinch.current.centerY - initialPinch.current.translateY) * scaleDiff;
      
      const clamped = clampTransform(
        { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
        containerRect,
        contentRect,
        initialPinch.current.scale
      );
      
      setTransform(clamped);
      return;
    }
    
    // Handle single finger pan when zoomed in
    if (e.touches.length === 1 && isPanning.current && panStart.current && transform.scale > 1) {
      e.preventDefault();
      e.stopPropagation();
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - panStart.current.x;
      const deltaY = touch.clientY - panStart.current.y;
      
      const containerRect = container.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      
      const newTranslateX = panStart.current.translateX + deltaX;
      const newTranslateY = panStart.current.translateY + deltaY;
      
      const clamped = clampTransform(
        { scale: transform.scale, translateX: newTranslateX, translateY: newTranslateY },
        containerRect,
        contentRect,
        transform.scale
      );
      
      setTransform(clamped);
    }
  }, [containerRef, contentRef, transform.scale, getDistance, getCenter, minScale, maxScale, clampTransform]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // If we still have touches, update state accordingly
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
    const contentRect = content.getBoundingClientRect();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    let newScale = transform.scale * delta;
    newScale = Math.max(minScale, Math.min(maxScale, newScale));
    
    // Zoom towards mouse position
    const mouseX = e.clientX - containerRect.left - containerRect.width / 2;
    const mouseY = e.clientY - containerRect.top - containerRect.height / 2;
    
    const scaleChange = newScale / transform.scale;
    const newTranslateX = mouseX - (mouseX - transform.translateX) * scaleChange;
    const newTranslateY = mouseY - (mouseY - transform.translateY) * scaleChange;
    
    const clamped = clampTransform(
      { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
      containerRect,
      contentRect,
      transform.scale
    );
    
    setTransform(clamped);
  }, [containerRef, contentRef, transform, minScale, maxScale, clampTransform]);

  // Prevent default gestures on native platforms
  useEffect(() => {
    if (!isNative) return;

    // Disable default zoom on the document for native apps
    const preventDefaultGestures = (e: Event) => {
      if ((e as TouchEvent).touches?.length >= 2) {
        e.preventDefault();
      }
    };

    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('gestureend', (e) => e.preventDefault());
    
    return () => {
      document.removeEventListener('gesturestart', (e) => e.preventDefault());
      document.removeEventListener('gesturechange', (e) => e.preventDefault());
      document.removeEventListener('gestureend', (e) => e.preventDefault());
    };
  }, [isNative]);

  // Attach event listeners to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use non-passive listeners to allow preventDefault
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
    
    setTransform(prev => {
      const newScale = Math.min(maxScale, prev.scale * 1.25);
      
      if (container && content) {
        const containerRect = container.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        return clampTransform({ ...prev, scale: newScale }, containerRect, contentRect, prev.scale);
      }
      
      return { ...prev, scale: newScale };
    });
  }, [maxScale, containerRef, contentRef, clampTransform]);

  const zoomOut = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    
    setTransform(prev => {
      const newScale = Math.max(minScale, prev.scale / 1.25);
      
      // Reset translate when zooming back to 1 or below
      if (newScale <= 1) {
        return { scale: newScale, translateX: 0, translateY: 0 };
      }
      
      if (container && content) {
        const containerRect = container.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        return clampTransform({ ...prev, scale: newScale }, containerRect, contentRect, prev.scale);
      }
      
      return { ...prev, scale: newScale };
    });
  }, [minScale, containerRef, contentRef, clampTransform]);

  return {
    transform,
    zoomIn,
    zoomOut,
    resetZoom,
    scale: transform.scale,
    isZoomed: transform.scale > 1,
  };
}
