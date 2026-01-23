import { pdfjs } from 'react-pdf';

export interface TocItem {
  title: string;
  pageNumber: number;
  items?: TocItem[];
}

export interface ExtractedToc {
  items: TocItem[];
  extractedFrom: 'bookmarks' | 'text';
  extractedAt: string;
}

/**
 * Extract Table of Contents from a full PDF during upload.
 * Tries PDF bookmarks first, then falls back to text-based heading extraction.
 */
export async function extractTableOfContents(
  pdfBytes: ArrayBuffer
): Promise<ExtractedToc | null> {
  try {
    const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
    
    // Try bookmarks first
    const outline = await pdf.getOutline();
    if (outline && outline.length > 0) {
      const items = await processOutlineItems(pdf, outline);
      if (items.length > 0) {
        return {
          items,
          extractedFrom: 'bookmarks',
          extractedAt: new Date().toISOString(),
        };
      }
    }
    
    // Fall back to text-based extraction
    const headings = await extractHeadingsFromText(pdf);
    if (headings.length > 0) {
      return {
        items: headings,
        extractedFrom: 'text',
        extractedAt: new Date().toISOString(),
      };
    }
    
    return null;
  } catch (error) {
    console.error('[pdfTocExtractor] Error extracting TOC:', error);
    return null;
  }
}

/**
 * Process PDF outline items recursively to extract page numbers.
 */
async function processOutlineItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[]
): Promise<TocItem[]> {
  const processed: TocItem[] = [];
  
  for (const item of items) {
    let pageNumber = 1;
    
    // Get destination page
    if (item.dest) {
      try {
        let dest = item.dest;
        
        // If dest is a string, resolve it
        if (typeof dest === 'string') {
          dest = await pdf.getDestination(dest);
        }
        
        if (dest && Array.isArray(dest) && dest.length > 0) {
          const ref = dest[0];
          if (ref) {
            try {
              const pageIndex = await pdf.getPageIndex(ref);
              pageNumber = pageIndex + 1; // Convert to 1-based
            } catch {
              console.warn('[pdfTocExtractor] Could not get page index for:', item.title);
            }
          }
        }
      } catch {
        console.warn('[pdfTocExtractor] Error processing destination for:', item.title);
      }
    }

    const outlineItem: TocItem = {
      title: item.title || 'Untitled',
      pageNumber,
    };

    // Process nested items
    if (item.items && item.items.length > 0) {
      outlineItem.items = await processOutlineItems(pdf, item.items);
    }

    processed.push(outlineItem);
  }
  
  return processed;
}

/**
 * Extract headings from PDF text content by analyzing font sizes.
 * Scans all pages for better accuracy during upload.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractHeadingsFromText(pdf: any): Promise<TocItem[]> {
  const headings: TocItem[] = [];
  const numPages = pdf.numPages;
  
  // Limit to first 100 pages for very large documents
  const maxPages = Math.min(numPages, 100);
  
  interface TextItem {
    text: string;
    fontSize: number;
    pageNumber: number;
  }
  
  const allText: TextItem[] = [];
  
  // First pass: collect all text with font sizes
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of textContent.items as any[]) {
        if (item.str && item.str.trim()) {
          const fontSize = Math.abs(item.transform?.[0] || item.height || 12);
          allText.push({
            text: item.str.trim(),
            fontSize,
            pageNumber: pageNum,
          });
        }
      }
    } catch (err) {
      console.warn(`[pdfTocExtractor] Error reading page ${pageNum}:`, err);
    }
  }
  
  if (allText.length === 0) return [];
  
  // Calculate font size statistics
  const fontSizes = allText.map(t => t.fontSize).sort((a, b) => a - b);
  const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)];
  const headingThreshold = medianFontSize * 1.2;
  
  // Group text by page and find potential headings
  const seenHeadings = new Set<string>();
  
  for (const item of allText) {
    if (item.fontSize >= headingThreshold) {
      const cleanText = item.text.trim();
      
      // Skip if too short, too long, or already seen
      if (cleanText.length < 3 || cleanText.length > 100) continue;
      
      // Skip common non-heading patterns
      if (/^\d+$/.test(cleanText)) continue; // Just numbers
      if (/^page\s+\d+$/i.test(cleanText)) continue; // Page numbers
      if (/^(chapter|section|part)\s*$/i.test(cleanText)) continue; // Incomplete headings
      
      // Create a normalized key for deduplication
      const normalizedKey = `${item.pageNumber}-${cleanText.toLowerCase()}`;
      if (seenHeadings.has(normalizedKey)) continue;
      
      seenHeadings.add(normalizedKey);
      headings.push({
        title: cleanText,
        pageNumber: item.pageNumber,
      });
    }
  }
  
  // Sort by page number
  headings.sort((a, b) => a.pageNumber - b.pageNumber);
  
  // Limit to 100 headings max
  return headings.slice(0, 100);
}
