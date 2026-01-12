import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingPageIndicatorProps {
  currentPage: number;
  totalPages: number;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function FloatingPageIndicator({ 
  currentPage, 
  totalPages, 
  containerRef 
}: FloatingPageIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      
      // Only show if actually scrolling (not just initial render)
      if (Math.abs(currentScrollTop - lastScrollTopRef.current) > 5) {
        setIsVisible(true);
        
        // Clear any existing timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        
        // Hide after 1.5 seconds of no scrolling
        hideTimeoutRef.current = setTimeout(() => {
          setIsVisible(false);
        }, 1500);
      }
      
      lastScrollTopRef.current = currentScrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [containerRef]);

  // Calculate scroll progress for the position indicator
  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  if (totalPages === 0) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2"
        >
          {/* Page number badge */}
          <div className="bg-foreground/90 text-background px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm">
            <div className="text-xs font-medium text-center whitespace-nowrap">
              {currentPage}
            </div>
            <div className="text-[10px] opacity-70 text-center">
              of {totalPages}
            </div>
          </div>
          
          {/* Vertical progress track */}
          <div className="relative w-1 h-24 bg-foreground/20 rounded-full overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 right-0 bg-primary rounded-full"
              initial={{ height: 0 }}
              animate={{ height: `${progress}%` }}
              transition={{ duration: 0.15 }}
            />
            {/* Current position dot */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-md border-2 border-background"
              initial={{ top: 0 }}
              animate={{ top: `calc(${progress}% - 6px)` }}
              transition={{ duration: 0.15 }}
              style={{ 
                top: `clamp(0px, calc(${progress}% - 6px), calc(100% - 12px))` 
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
