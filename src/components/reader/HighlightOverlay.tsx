import { memo, useCallback } from 'react';
import { UserHighlight, HIGHLIGHT_COLORS, HighlightColor } from '@/hooks/useUserHighlights';

interface HighlightOverlayProps {
  highlights: UserHighlight[];
  pageWidth: number;
  pageHeight: number;
  onDeleteHighlight?: (highlightId: string) => void;
  isHighlightMode?: boolean;
}

export const HighlightOverlay = memo(function HighlightOverlay({
  highlights,
  pageWidth,
  pageHeight,
  onDeleteHighlight,
  isHighlightMode = false,
}: HighlightOverlayProps) {
  const handleClick = useCallback((e: React.MouseEvent, highlightId: string) => {
    if (isHighlightMode && onDeleteHighlight) {
      e.stopPropagation();
      onDeleteHighlight(highlightId);
    }
  }, [isHighlightMode, onDeleteHighlight]);

  if (highlights.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: pageWidth, height: pageHeight }}
    >
      {highlights.map((highlight) => {
        const colorConfig = HIGHLIGHT_COLORS[highlight.color as HighlightColor] || HIGHLIGHT_COLORS.yellow;
        
        return (
          <div
            key={highlight.id}
            className={`
              absolute rounded-sm transition-all duration-150
              ${isHighlightMode ? 'pointer-events-auto cursor-pointer hover:opacity-70' : ''}
            `}
            style={{
              left: `${highlight.x_percent}%`,
              top: `${highlight.y_percent}%`,
              width: `${highlight.width_percent}%`,
              height: `${highlight.height_percent}%`,
              backgroundColor: colorConfig.bg,
              border: isHighlightMode ? `1px dashed ${colorConfig.border}` : 'none',
            }}
            onClick={(e) => handleClick(e, highlight.id)}
            title={isHighlightMode ? 'Click to delete' : undefined}
          />
        );
      })}
    </div>
  );
});
