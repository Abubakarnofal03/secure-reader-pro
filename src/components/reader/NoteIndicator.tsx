import { memo } from 'react';
import { StickyNote } from 'lucide-react';

interface NoteIndicatorProps {
  noteCount: number;
  onClick?: () => void;
}

export const NoteIndicator = memo(function NoteIndicator({
  noteCount,
  onClick,
}: NoteIndicatorProps) {
  if (noteCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="
        absolute top-2 right-2 z-10
        flex items-center gap-1 px-2 py-1
        bg-primary/90 text-primary-foreground
        rounded-full shadow-md
        text-xs font-medium
        hover:bg-primary transition-colors
      "
      title={`${noteCount} note${noteCount > 1 ? 's' : ''} on this page`}
    >
      <StickyNote className="h-3 w-3" />
      {noteCount}
    </button>
  );
});
