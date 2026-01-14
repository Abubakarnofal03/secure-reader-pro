import { useState, useEffect } from 'react';

export interface OutlineItem {
  title: string;
  pageNumber: number;
  items?: OutlineItem[];
}

// Use 'any' to avoid type conflicts between react-pdf and pdfjs-dist versions
type PDFDocument = any;

/**
 * Hook to extract the PDF outline (table of contents) from a PDF document.
 * Uses pdfjs-dist's getOutline() method to get bookmarks.
 */
export function usePdfOutline(pdfDocument: PDFDocument | null) {
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfDocument) {
      setOutline([]);
      return;
    }

    const extractOutline = async () => {
      setLoading(true);
      setError(null);

      try {
        const rawOutline = await pdfDocument.getOutline();
        
        if (!rawOutline || rawOutline.length === 0) {
          setOutline([]);
          setLoading(false);
          return;
        }

        // Process outline items recursively
        const processItems = async (items: any[]): Promise<OutlineItem[]> => {
          const processed: OutlineItem[] = [];
          
          for (const item of items) {
            let pageNumber = 1;
            
            // Get destination page
            if (item.dest) {
              try {
                let dest = item.dest;
                
                // If dest is a string, resolve it
                if (typeof dest === 'string') {
                  dest = await pdfDocument.getDestination(dest);
                }
                
                if (dest && Array.isArray(dest) && dest.length > 0) {
                  // The first element is typically a reference to the page
                  const ref = dest[0];
                  if (ref) {
                    try {
                      const pageIndex = await pdfDocument.getPageIndex(ref);
                      pageNumber = pageIndex + 1; // Convert to 1-based
                    } catch (e) {
                      console.warn('Could not get page index for outline item:', item.title);
                    }
                  }
                }
              } catch (e) {
                console.warn('Error processing destination for:', item.title, e);
              }
            }

            const outlineItem: OutlineItem = {
              title: item.title || 'Untitled',
              pageNumber,
            };

            // Process nested items
            if (item.items && item.items.length > 0) {
              outlineItem.items = await processItems(item.items);
            }

            processed.push(outlineItem);
          }
          
          return processed;
        };

        const processedOutline = await processItems(rawOutline);
        setOutline(processedOutline);
      } catch (err) {
        console.error('Error extracting PDF outline:', err);
        setError('Failed to extract table of contents');
        setOutline([]);
      } finally {
        setLoading(false);
      }
    };

    extractOutline();
  }, [pdfDocument]);

  return { outline, loading, error, hasOutline: outline.length > 0 };
}
