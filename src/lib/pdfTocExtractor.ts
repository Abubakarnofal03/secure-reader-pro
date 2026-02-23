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

  // Scan all pages (up to 500) for comprehensive TOC extraction
  const maxPages = Math.min(numPages, 500);

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

  // Count frequency of each font size to find the body text size
  const fontSizeFrequency = new Map<number, number>();
  for (const item of allText) {
    const rounded = Math.round(item.fontSize * 10) / 10;
    fontSizeFrequency.set(rounded, (fontSizeFrequency.get(rounded) || 0) + 1);
  }

  // The most common font size is body text - headings must be significantly larger
  let bodyFontSize = medianFontSize;
  let maxFreq = 0;
  for (const [size, freq] of fontSizeFrequency) {
    if (freq > maxFreq) {
      maxFreq = freq;
      bodyFontSize = size;
    }
  }

  // Require at least 30% larger than body text to be a heading
  const headingThreshold = bodyFontSize * 1.3;

  // Find distinct heading tiers (unique large sizes)
  const uniqueLargeSizes = [...new Set(
    allText.filter(t => t.fontSize >= headingThreshold).map(t => Math.round(t.fontSize * 10) / 10)
  )].sort((a, b) => b - a);

  // Only take top 3 tiers to avoid picking up slightly-bold body text
  const headingTiers = new Set(uniqueLargeSizes.slice(0, 3));
  if (headingTiers.size === 0) return [];

  const minHeadingSize = Math.min(...headingTiers);

  // Group text by page and find potential headings
  const seenHeadings = new Set<string>();

  for (const item of allText) {
    const roundedSize = Math.round(item.fontSize * 10) / 10;
    if (roundedSize < minHeadingSize) continue;

    const cleanText = item.text.trim();

    // Skip if too short, too long, or already seen
    if (cleanText.length < 3 || cleanText.length > 120) continue;

    // Skip common non-heading patterns
    if (/^\d+$/.test(cleanText)) continue; // Just numbers
    if (/^page\s+\d+$/i.test(cleanText)) continue; // Page numbers
    if (/^(chapter|section|part)\s*$/i.test(cleanText)) continue; // Incomplete headings
    if (/^\W+$/.test(cleanText)) continue; // Only punctuation/symbols
    if (/^(www\.|http)/i.test(cleanText)) continue; // URLs

    // Deduplicate by normalized text (across pages)
    const normalizedText = cleanText.toLowerCase().replace(/\s+/g, ' ');
    if (seenHeadings.has(normalizedText)) continue;

    seenHeadings.add(normalizedText);
    headings.push({
      title: cleanText,
      pageNumber: item.pageNumber,
    });
  }

  // Sort by page number
  headings.sort((a, b) => a.pageNumber - b.pageNumber);

  // Limit to 150 headings max
  return headings.slice(0, 150);
}
