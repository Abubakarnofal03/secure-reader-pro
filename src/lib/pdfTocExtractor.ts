import { pdfjs } from 'react-pdf';

export interface TocItem {
  title: string;
  pageNumber: number;
  items?: TocItem[];
  isManual?: boolean;
}

export interface ExtractedToc {
  items: TocItem[];
  extractedFrom: 'bookmarks' | 'text' | 'manual';
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

    if (item.dest) {
      try {
        let dest = item.dest;
        if (typeof dest === 'string') {
          dest = await pdf.getDestination(dest);
        }
        if (dest && Array.isArray(dest) && dest.length > 0) {
          const ref = dest[0];
          if (ref) {
            try {
              const pageIndex = await pdf.getPageIndex(ref);
              pageNumber = pageIndex + 1;
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

    if (item.items && item.items.length > 0) {
      outlineItem.items = await processOutlineItems(pdf, item.items);
    }

    processed.push(outlineItem);
  }

  return processed;
}

/**
 * Extract headings from PDF text content by analyzing font sizes.
 * Scans all pages. Merges adjacent text fragments on the same line.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractHeadingsFromText(pdf: any): Promise<TocItem[]> {
  const numPages = pdf.numPages;

  interface RawTextItem {
    text: string;
    fontSize: number;
    pageNumber: number;
    y: number; // vertical position for line merging
  }

  const allText: RawTextItem[] = [];

  // First pass: collect all text with font sizes and positions
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of textContent.items as any[]) {
        if (item.str && item.str.trim()) {
          const fontSize = Math.abs(item.transform?.[0] || item.height || 12);
          const y = item.transform?.[5] || 0;
          allText.push({
            text: item.str.trim(),
            fontSize,
            pageNumber: pageNum,
            y: Math.round(y),
          });
        }
      }
    } catch (err) {
      console.warn(`[pdfTocExtractor] Error reading page ${pageNum}:`, err);
    }
  }

  if (allText.length === 0) return [];

  // Merge adjacent text fragments that share the same page, font size (±0.5), and Y position (±2)
  const merged: RawTextItem[] = [];
  for (const item of allText) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.pageNumber === item.pageNumber &&
      Math.abs(last.fontSize - item.fontSize) < 0.5 &&
      Math.abs(last.y - item.y) < 3
    ) {
      last.text += ' ' + item.text;
    } else {
      merged.push({ ...item });
    }
  }

  // Count frequency of each font size to find body text size
  const fontSizeFrequency = new Map<number, number>();
  for (const item of merged) {
    const rounded = Math.round(item.fontSize * 10) / 10;
    fontSizeFrequency.set(rounded, (fontSizeFrequency.get(rounded) || 0) + 1);
  }

  let bodyFontSize = 12;
  let maxFreq = 0;
  for (const [size, freq] of fontSizeFrequency) {
    if (freq > maxFreq) {
      maxFreq = freq;
      bodyFontSize = size;
    }
  }

  // Headings must be at least 15% larger than body text (relaxed from 30%)
  const headingThreshold = bodyFontSize * 1.15;

  // Find distinct heading tiers
  const uniqueLargeSizes = [...new Set(
    merged.filter(t => t.fontSize >= headingThreshold).map(t => Math.round(t.fontSize * 10) / 10)
  )].sort((a, b) => b - a);

  // Take top 5 tiers (relaxed from 3)
  const headingTiers = new Set(uniqueLargeSizes.slice(0, 5));
  if (headingTiers.size === 0) return [];

  const minHeadingSize = Math.min(...headingTiers);

  // Extract headings
  const headings: TocItem[] = [];
  const seenHeadings = new Set<string>();

  for (const item of merged) {
    const roundedSize = Math.round(item.fontSize * 10) / 10;
    if (roundedSize < minHeadingSize) continue;

    const cleanText = item.text.trim();

    // Skip too short, too long
    if (cleanText.length < 3 || cleanText.length > 150) continue;

    // Skip common non-heading patterns
    if (/^\d+$/.test(cleanText)) continue;
    if (/^page\s+\d+$/i.test(cleanText)) continue;
    if (/^\W+$/.test(cleanText)) continue;
    if (/^(www\.|http)/i.test(cleanText)) continue;

    // Deduplicate
    const normalizedText = cleanText.toLowerCase().replace(/\s+/g, ' ');
    if (seenHeadings.has(normalizedText)) continue;

    seenHeadings.add(normalizedText);
    headings.push({
      title: cleanText,
      pageNumber: item.pageNumber,
    });
  }

  headings.sort((a, b) => a.pageNumber - b.pageNumber);
  return headings.slice(0, 300);
}
