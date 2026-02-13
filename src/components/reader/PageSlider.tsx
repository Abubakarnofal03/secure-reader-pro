import { useState, useCallback, useRef, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';

interface PageSliderProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PageSlider({ currentPage, totalPages, onPageChange }: PageSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewPage, setPreviewPage] = useState(currentPage);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Update preview when current page changes externally
  useEffect(() => {
    if (!isDragging) {
      setPreviewPage(currentPage);
    }
  }, [currentPage, isDragging]);

  const handleValueChange = useCallback((values: number[]) => {
    const page = values[0];
    setPreviewPage(page);
    setIsDragging(true);
  }, []);

  const handleValueCommit = useCallback(
    (values: number[]) => {
      const page = values[0];
      onPageChange(page);
      setIsDragging(false);
    },
    [onPageChange]
  );

  // Generate tick marks for every 50 or 100 pages
  const getTickMarks = () => {
    if (totalPages <= 20) return [];
    
    const interval = totalPages > 200 ? 100 : totalPages > 50 ? 50 : 10;
    const ticks: number[] = [];
    
    for (let i = interval; i < totalPages; i += interval) {
      ticks.push(i);
    }
    
    return ticks;
  };

  const tickMarks = getTickMarks();
  const displayPage = isDragging ? previewPage : currentPage;

  if (totalPages <= 1) return null;

  return (
    <div className="flex-1 mx-4 relative" ref={sliderRef}>
      {/* Page preview tooltip when dragging */}
      {isDragging && (
        <div 
          className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md shadow-lg whitespace-nowrap z-10"
          style={{
            left: `${((previewPage - 1) / (totalPages - 1)) * 100}%`,
          }}
        >
          Page {previewPage}
        </div>
      )}
      
      {/* Tick marks */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none">
        {tickMarks.map((tick) => (
          <div
            key={tick}
            className="absolute w-0.5 h-2 bg-muted-foreground/30 rounded-full"
            style={{
              left: `${((tick - 1) / (totalPages - 1)) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          />
        ))}
      </div>

      <Slider
        value={[displayPage]}
        min={1}
        max={totalPages}
        step={1}
        onValueChange={handleValueChange}
        onValueCommit={handleValueCommit}
        className="w-full"
      />

      {/* Page range labels */}
      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
        <span>1</span>
        <span>{totalPages}</span>
      </div>
    </div>
  );
}
