import { useEffect, useRef, useState, useCallback } from 'react';

interface UseScrollPageDetectionOptions {
  totalPages: number;
  enabled?: boolean;
}

/**
 * Hook that uses IntersectionObserver to detect which page is currently
 * most visible in a scrollable container. Returns the current page number.
 */
export function useScrollPageDetection({
  totalPages,
  enabled = true,
}: UseScrollPageDetectionOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const visibilityMap = useRef<Map<number, number>>(new Map());

  // Register a page element with its page number
  const registerPage = useCallback((pageNumber: number, element: HTMLDivElement | null) => {
    if (element) {
      pageRefs.current.set(pageNumber, element);
    } else {
      pageRefs.current.delete(pageNumber);
    }
  }, []);

  // Scroll to a specific page
  const scrollToPage = useCallback((pageNumber: number, behavior: ScrollBehavior = 'smooth') => {
    const pageElement = pageRefs.current.get(pageNumber);
    if (pageElement && containerRef.current) {
      pageElement.scrollIntoView({ behavior, block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (!enabled || totalPages === 0) return;

    const container = containerRef.current;
    if (!container) return;

    // Calculate which page is most visible based on intersection ratios
    const updateCurrentPage = () => {
      let maxVisibility = 0;
      let mostVisiblePage = 1;

      visibilityMap.current.forEach((ratio, pageNum) => {
        if (ratio > maxVisibility) {
          maxVisibility = ratio;
          mostVisiblePage = pageNum;
        }
      });

      if (maxVisibility > 0) {
        setCurrentPage(mostVisiblePage);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.getAttribute('data-page') || '1', 10);
          if (entry.isIntersecting) {
            visibilityMap.current.set(pageNum, entry.intersectionRatio);
          } else {
            // Remove from visibility map when page exits viewport
            visibilityMap.current.delete(pageNum);
          }
        });
        updateCurrentPage();
      },
      {
        root: container,
        rootMargin: '0px',
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
      }
    );

    // Observe all registered pages
    pageRefs.current.forEach((element) => {
      observer.observe(element);
    });

    // Re-observe when pages change
    const checkNewPages = () => {
      pageRefs.current.forEach((element, pageNum) => {
        if (!visibilityMap.current.has(pageNum)) {
          observer.observe(element);
        }
      });
    };

    // Use MutationObserver to detect when new pages are added
    const mutationObserver = new MutationObserver(checkNewPages);
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      visibilityMap.current.clear();
    };
  }, [enabled, totalPages]);

  return {
    containerRef,
    registerPage,
    currentPage,
    scrollToPage,
  };
}
