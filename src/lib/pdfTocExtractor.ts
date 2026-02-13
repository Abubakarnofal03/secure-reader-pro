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
 * 
 * Note: With the architecture refactoring, client-side PDF.js rendering has been removed.
 * TOC extraction during upload should be done server-side in the edge function.
 * This function is kept as a stub for backward compatibility with the admin upload flow.
 * If bookmarks are needed, extract them server-side using pdf-lib.
 */
export async function extractTableOfContents(
  _pdfBytes: ArrayBuffer
): Promise<ExtractedToc | null> {
  // TOC extraction is now handled server-side or via stored metadata.
  // This stub returns null; the admin upload flow stores TOC in the DB.
  console.warn('[pdfTocExtractor] Client-side TOC extraction is no longer supported. Use stored TOC from database.');
  return null;
}
