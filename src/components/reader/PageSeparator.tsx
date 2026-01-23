import { memo } from 'react';

interface PageSeparatorProps {
  pageNumber: number;
  totalPages: number;
}

export const PageSeparator = memo(function PageSeparator({ 
  pageNumber, 
  totalPages 
}: PageSeparatorProps) {
  // Don't show separator after the last page
  if (pageNumber >= totalPages) {
    return null;
  }

  return (
    <div className="w-full flex items-center justify-center py-4 my-2">
      <div className="flex-1 h-px bg-border/50" />
      <span className="px-4 py-1.5 text-xs text-muted-foreground font-medium bg-muted/30 rounded-full border border-border/30">
        Page {pageNumber} of {totalPages}
      </span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
});
