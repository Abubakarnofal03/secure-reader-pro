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

  const initialPinch = useRef<{
    distance: number;
    scale: number;
    centerX: number;
    centerY: number;
    translateX: number;
    translateY: number;
  } | null>(null);

  const lastTapTime = useRef<number>(0);
  const lastTapPosition = useRef<{ x: number; y: number } | null>(null);
  const isPinching = useRef(false);

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

  const clampTransform = useCallback((newTransform: TransformState, containerRect: DOMRect, contentRect: DOMRect): TransformState => {
    const { scale, translateX, translateY } = newTransform;
    
    const scaledWidth = contentRect.width * scale;
    const scaledHeight = contentRect.height * scale;
    
    let clampedX = translateX;
    let clampedY = translateY;
    
    // If content is smaller than container, center it
    if (scaledWidth <= containerRect.width) {
      clampedX = 0;
    } else {
      // Limit panning so content doesn't go out of bounds
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

    // Double tap to toggle zoom
    if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];
      const tapPosition = { x: touch.clientX, y: touch.clientY };

      if (lastTapPosition.current) {
        const timeDiff = now - lastTapTime.current;
        const dx = Math.abs(tapPosition.x - lastTapPosition.current.x);
        const dy = Math.abs(tapPosition.y - lastTapPosition.current.y);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (timeDiff < 300 && distance < 50) {
          e.preventDefault();
          
          const containerRect = container.getBoundingClientRect();
          const contentRect = content.getBoundingClientRect();
          
          if (transform.scale > 1.1) {
            // Zoom out to 1
            setTransform({ scale: 1, translateX: 0, translateY: 0 });
          } else {
            // Zoom in to 2x centered on tap point
            const newScale = 2;
            const tapX = touch.clientX - containerRect.left - containerRect.width / 2;
            const tapY = touch.clientY - containerRect.top - containerRect.height / 2;
            
            // Calculate offset to zoom towards tap point
            const newTranslateX = -tapX * (newScale - 1);
            const newTranslateY = -tapY * (newScale - 1);
            
            const clamped = clampTransform(
              { scale: newScale, translateX: newTranslateX, translateY: newTranslateY },
              containerRect,
              contentRect
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
    }

    // Pinch start
    if (e.touches.length === 2) {
      e.preventDefault();
      isPinching.current = true;
      
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
    }
  }, [containerRef, contentRef, transform, getDistance, getCenter, clampTransform]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Pinch zoom
    if (e.touches.length === 2 && initialPinch.current) {
      e.preventDefault();
      
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
        contentRect
      );
      
      setTransform(clamped);
    }
    
    // Single finger pan when zoomed in
    if (e.touches.length === 1 && transform.scale > 1 && !isPinching.current) {
      // Pan handled by native scroll since we use overflow
    }
  }, [containerRef, contentRef, transform.scale, getDistance, getCenter, minScale, maxScale, clampTransform]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinch.current = null;
      isPinching.current = false;
    }
  }, []);

  // Handle wheel zoom for desktop
  const handleWheel = useCallback((e: WheelEvent) => {
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
      contentRect
    );
    
    setTransform(clamped);
  }, [containerRef, contentRef, transform, minScale, maxScale, clampTransform]);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel]);

  const resetZoom = useCallback(() => {
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setTransform(prev => {
      const newScale = Math.min(maxScale, prev.scale * 1.25);
      return { ...prev, scale: newScale };
    });
  }, [maxScale]);

  const zoomOut = useCallback(() => {
    setTransform(prev => {
      const newScale = Math.max(minScale, prev.scale / 1.25);
      if (newScale <= 1) {
        return { scale: newScale, translateX: 0, translateY: 0 };
      }
      return { ...prev, scale: newScale };
    });
  }, [minScale]);

  return {
    transform,
    zoomIn,
    zoomOut,
    resetZoom,
    scale: transform.scale,
  };
}
