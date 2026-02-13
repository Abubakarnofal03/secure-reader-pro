import { useState, useEffect } from 'react';

export interface ExtractedHeading {
  title: string;
  pageNumber: number;
  fontSize: number;
}

type PDFDocument = any;

/**
 * Hook to extract headings from PDF text content by analyzing font sizes.
 * This is a fallback when getOutline() returns empty (no bookmarks).
 */
export function usePdfTextExtraction(pdfDocument: PDFDocument | null, enabled: boolean = true) {
  const [headings, setHeadings] = useState<ExtractedHeading[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfDocument || !enabled) {
      setHeadings([]);
      return;
    }

    const extractHeadings = async () => {
      setLoading(true);
      setError(null);

      try {
        const allHeadings: ExtractedHeading[] = [];
        const numPages = pdfDocument.numPages;
        // Only analyze first 30 pages for performance
        const pagesToAnalyze = Math.min(numPages, 30);
        
        // First pass: collect all text items with their font sizes
        const allFontSizes: number[] = [];
        const pageTextData: { pageNum: number; items: any[] }[] = [];

        for (let i = 1; i <= pagesToAnalyze; i++) {
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          
          const items = textContent.items.filter((item: any) => {
            // Filter out empty or whitespace-only text
            return item.str && item.str.trim().length > 0;
          });

          pageTextData.push({ pageNum: i, items });
          
          for (const item of items) {
            if (item.transform && item.transform[0]) {
              const fontSize = Math.abs(item.transform[0]);
              if (fontSize > 0) {
                allFontSizes.push(fontSize);
              }
            }
          }
        }

        if (allFontSizes.length === 0) {
          setHeadings([]);
          setLoading(false);
          return;
        }

        // Calculate font size statistics
        allFontSizes.sort((a, b) => a - b);
        const medianFontSize = allFontSizes[Math.floor(allFontSizes.length / 2)];
        
        // Find unique large font sizes (potential heading sizes)
        const uniqueSizes = [...new Set(allFontSizes.filter(s => s > medianFontSize * 1.15))];
        uniqueSizes.sort((a, b) => b - a);
        
        // Take top 3-4 largest font sizes as heading candidates
        const headingFontSizes = uniqueSizes.slice(0, 4);
        
        if (headingFontSizes.length === 0) {
          setHeadings([]);
          setLoading(false);
          return;
        }

        const minHeadingSize = Math.min(...headingFontSizes);

        // Second pass: extract headings
        const seenTitles = new Set<string>();

        for (const { pageNum, items } of pageTextData) {
          for (const item of items) {
            const fontSize = item.transform ? Math.abs(item.transform[0]) : 0;
            
            if (fontSize >= minHeadingSize) {
              const title = item.str.trim();
              
              // Skip if too short, all numbers, or already seen
              if (title.length < 3) continue;
              if (/^\d+$/.test(title)) continue;
              if (seenTitles.has(title.toLowerCase())) continue;
              
              // Skip page numbers and common non-heading patterns
              if (/^(page|chapter|section|figure|table)\s*\d*$/i.test(title)) continue;
              
              seenTitles.add(title.toLowerCase());
              allHeadings.push({
                title,
                pageNumber: pageNum,
                fontSize,
              });
            }
          }
        }

        // Sort by page number, then by fontSize (larger first on same page)
        allHeadings.sort((a, b) => {
          if (a.pageNumber !== b.pageNumber) {
            return a.pageNumber - b.pageNumber;
          }
          return b.fontSize - a.fontSize;
        });

        // Limit to reasonable number of headings
        setHeadings(allHeadings.slice(0, 100));
      } catch (err) {
        console.error('Error extracting headings from PDF text:', err);
        setError('Failed to extract headings from text');
        setHeadings([]);
      } finally {
        setLoading(false);
      }
    };

    extractHeadings();
  }, [pdfDocument, enabled]);

  return { headings, loading, error, hasHeadings: headings.length > 0 };
}
