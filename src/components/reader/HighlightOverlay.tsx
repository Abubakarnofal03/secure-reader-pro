import { memo, useCallback, useState } from 'react';
import { UserHighlight, HIGHLIGHT_COLORS, HighlightColor } from '@/hooks/useUserHighlights';
import { Trash2 } from 'lucide-react';

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
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);

  const handleClick = useCallback((e: React.MouseEvent, highlightId: string) => {
    e.stopPropagation();
    if (isHighlightMode && onDeleteHighlight) {
      // In highlight mode, delete immediately on tap
      onDeleteHighlight(highlightId);
    } else {
      // Outside highlight mode, toggle selection to show delete button
      setSelectedHighlightId(prev => prev === highlightId ? null : highlightId);
    }
  }, [isHighlightMode, onDeleteHighlight]);

  const handleDelete = useCallback((e: React.MouseEvent, highlightId: string) => {
    e.stopPropagation();
    onDeleteHighlight?.(highlightId);
    setSelectedHighlightId(null);
  }, [onDeleteHighlight]);

  if (highlights.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: pageWidth, height: pageHeight }}
      onClick={() => setSelectedHighlightId(null)}
    >
      {highlights.map((highlight) => {
        const colorConfig = HIGHLIGHT_COLORS[highlight.color as HighlightColor] || HIGHLIGHT_COLORS.yellow;
        const isSelected = selectedHighlightId === highlight.id;
        
        return (
          <div
            key={highlight.id}
            className="absolute rounded-sm transition-all duration-150 pointer-events-auto cursor-pointer"
            style={{
              left: `${highlight.x_percent}%`,
              top: `${highlight.y_percent}%`,
              width: `${highlight.width_percent}%`,
              height: `${highlight.height_percent}%`,
              backgroundColor: colorConfig.bg,
              border: isHighlightMode || isSelected ? `1px dashed ${colorConfig.border}` : 'none',
            }}
            onClick={(e) => handleClick(e, highlight.id)}
          >
            {/* Delete button shown when highlight is selected */}
            {isSelected && onDeleteHighlight && (
              <button
                onClick={(e) => handleDelete(e, highlight.id)}
                className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-destructive text-destructive-foreground text-[10px] font-medium shadow-md z-10 whitespace-nowrap"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
});
