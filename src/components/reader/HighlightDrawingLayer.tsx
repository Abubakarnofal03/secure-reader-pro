import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { HIGHLIGHT_COLORS, HighlightColor } from '@/hooks/useUserHighlights';

interface HighlightDrawingLayerProps {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  selectedColor: HighlightColor;
  onHighlightCreated: (
    pageNumber: number,
    xPercent: number,
    yPercent: number,
    widthPercent: number,
    heightPercent: number
  ) => void;
  enabled: boolean;
}

interface DrawingRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const HighlightDrawingLayer = memo(function HighlightDrawingLayer({
  pageNumber,
  pageWidth,
  pageHeight,
  selectedColor,
  onHighlightCreated,
  enabled,
}: HighlightDrawingLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingRect, setDrawingRect] = useState<DrawingRect | null>(null);

  // Get position relative to the container
  const getRelativePosition = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(pageWidth, clientX - rect.left)),
      y: Math.max(0, Math.min(pageHeight, clientY - rect.top)),
    };
  }, [pageWidth, pageHeight]);

  // Start drawing
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const pos = getRelativePosition(e.clientX, e.clientY);
    setIsDrawing(true);
    setDrawingRect({
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
    
    // Capture pointer for smooth tracking
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [enabled, getRelativePosition]);

  // Update drawing
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !drawingRect) return;
    
    e.preventDefault();
    const pos = getRelativePosition(e.clientX, e.clientY);
    setDrawingRect((prev) => prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null);
  }, [isDrawing, drawingRect, getRelativePosition]);

  // Finish drawing
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !drawingRect) return;
    
    e.preventDefault();
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Calculate final rectangle
    const minX = Math.min(drawingRect.startX, drawingRect.currentX);
    const minY = Math.min(drawingRect.startY, drawingRect.currentY);
    const width = Math.abs(drawingRect.currentX - drawingRect.startX);
    const height = Math.abs(drawingRect.currentY - drawingRect.startY);
    
    // Convert to percentages
    const xPercent = (minX / pageWidth) * 100;
    const yPercent = (minY / pageHeight) * 100;
    const widthPercent = (width / pageWidth) * 100;
    const heightPercent = (height / pageHeight) * 100;
    
    // Only create if it's a meaningful size
    if (widthPercent >= 1 && heightPercent >= 0.5) {
      onHighlightCreated(pageNumber, xPercent, yPercent, widthPercent, heightPercent);
    }
    
    setIsDrawing(false);
    setDrawingRect(null);
  }, [isDrawing, drawingRect, pageNumber, pageWidth, pageHeight, onHighlightCreated]);

  // Cancel on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawing) {
        setIsDrawing(false);
        setDrawingRect(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing]);

  if (!enabled) {
    return null;
  }

  // Calculate display rectangle
  const displayRect = drawingRect ? {
    left: Math.min(drawingRect.startX, drawingRect.currentX),
    top: Math.min(drawingRect.startY, drawingRect.currentY),
    width: Math.abs(drawingRect.currentX - drawingRect.startX),
    height: Math.abs(drawingRect.currentY - drawingRect.startY),
  } : null;

  const colorConfig = HIGHLIGHT_COLORS[selectedColor];

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-crosshair touch-none"
      style={{ width: pageWidth, height: pageHeight }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        setIsDrawing(false);
        setDrawingRect(null);
      }}
    >
      {/* Drawing preview */}
      {displayRect && displayRect.width > 0 && displayRect.height > 0 && (
        <div
          className="absolute rounded-sm pointer-events-none"
          style={{
            left: displayRect.left,
            top: displayRect.top,
            width: displayRect.width,
            height: displayRect.height,
            backgroundColor: colorConfig.bg,
            border: `2px dashed ${colorConfig.border}`,
          }}
        />
      )}
    </div>
  );
});
