import { useState, useEffect } from 'react';
import { usePdfTextExtraction, ExtractedHeading } from './usePdfTextExtraction';

export interface OutlineItem {
  title: string;
  pageNumber: number;
  items?: OutlineItem[];
}

// Use 'any' to avoid type conflicts between react-pdf and pdfjs-dist versions
type PDFDocument = any;

/**
 * Hook to extract the PDF outline (table of contents) from a PDF document.
 * Uses pdfjs-dist's getOutline() method first, then falls back to text-based extraction.
 */
export function usePdfOutline(pdfDocument: PDFDocument | null) {
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsFallback, setNeedsFallback] = useState(false);

  // Text extraction fallback - only enabled when needed
  const { 
    headings: extractedHeadings, 
    loading: textLoading, 
    hasHeadings 
  } = usePdfTextExtraction(pdfDocument, needsFallback);

  // Convert extracted headings to outline format
  useEffect(() => {
    if (needsFallback && !textLoading && extractedHeadings.length > 0) {
      const converted: OutlineItem[] = extractedHeadings.map((h: ExtractedHeading) => ({
        title: h.title,
        pageNumber: h.pageNumber,
      }));
      setOutline(converted);
      setLoading(false);
    } else if (needsFallback && !textLoading && extractedHeadings.length === 0) {
      setLoading(false);
    }
  }, [needsFallback, textLoading, extractedHeadings]);

  useEffect(() => {
    if (!pdfDocument) {
      setOutline([]);
      setNeedsFallback(false);
      return;
    }

    const extractOutline = async () => {
      setLoading(true);
      setError(null);
      setNeedsFallback(false);

      try {
        const rawOutline = await pdfDocument.getOutline();
        
        if (!rawOutline || rawOutline.length === 0) {
          // No bookmarks found - enable text-based fallback
          console.log('No PDF bookmarks found, using text-based heading extraction');
          setNeedsFallback(true);
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
        setLoading(false);
      } catch (err) {
        console.error('Error extracting PDF outline:', err);
        setError('Failed to extract table of contents');
        setOutline([]);
        // Try fallback on error
        setNeedsFallback(true);
      }
    };

    extractOutline();
  }, [pdfDocument]);

  const isLoading = loading || (needsFallback && textLoading);

  return { 
    outline, 
    loading: isLoading, 
    error, 
    hasOutline: outline.length > 0,
    isFromTextExtraction: needsFallback && hasHeadings
  };
}
