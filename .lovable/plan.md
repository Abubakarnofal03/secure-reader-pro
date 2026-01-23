
# Server-Side Table of Contents Extraction

## Problem

The PDF reader's Table of Contents feature doesn't work properly for segmented PDFs because:
- The current `usePdfOutline` hook extracts the outline from the `pdfDocument` object
- For segmented content, the reader only loads one segment at a time (50 pages each)
- The outline/bookmarks are stored in the **first segment** of the PDF, but point to pages that may be in other segments
- The text-based fallback only scans the first 30 pages of the visible segment

## Solution Overview

Extract the Table of Contents during admin upload (when the **full PDF is available**) and store it in the database. The reader will then fetch this pre-extracted TOC instead of trying to extract it from segments.

## Storage Strategy (Cost-Efficient)

### Option A: JSONB Column on `content` Table (Recommended)
- Add a `table_of_contents` column of type `jsonb` to the `content` table
- TOC data is typically small (a few KB for even large documents)
- JSONB is compressed and efficient
- No additional tables or joins needed
- Already covered by existing RLS policies

**Data Structure:**
```json
{
  "items": [
    { "title": "Chapter 1", "page": 1, "items": [...] },
    { "title": "Chapter 2", "page": 50 }
  ],
  "extractedFrom": "bookmarks" | "text",
  "extractedAt": "2025-01-23T..."
}
```

### Why Not a Separate Table?
- Would require foreign key relationships
- Additional RLS policies
- More complex queries
- Minimal benefit since TOC is always fetched with content

---

## Implementation Plan

### Step 1: Database Migration

Add a new JSONB column to the `content` table:

```sql
ALTER TABLE content 
ADD COLUMN table_of_contents jsonb DEFAULT NULL;

COMMENT ON COLUMN content.table_of_contents IS 
  'Pre-extracted PDF table of contents for segmented content';
```

### Step 2: Create TOC Extraction Utility

Create a new utility file `src/lib/pdfTocExtractor.ts` that:
- Takes the full PDF bytes (ArrayBuffer)
- Uses `pdfjs-dist` to load the document
- Extracts bookmarks using `getOutline()`
- Falls back to text-based heading extraction if no bookmarks
- Returns the structured TOC data

```text
┌───────────────────────────────────────────────────────────┐
│  extractTableOfContents(pdfBytes: ArrayBuffer)            │
│                                                           │
│  1. Load PDF with pdfjs-dist                              │
│  2. Try getOutline() for bookmarks                        │
│  3. If empty → scan pages for large-font headings         │
│  4. Return structured outline with page numbers           │
└───────────────────────────────────────────────────────────┘
```

### Step 3: Modify ContentUpload Component

Update `src/components/admin/ContentUpload.tsx` to:
1. After reading the PDF, extract the TOC before splitting into segments
2. Include the TOC data in the content insert query
3. Show "Extracting contents..." in the upload status

**Upload Flow:**
```text
Read PDF → Extract TOC → Split Segments → Create Record (with TOC) → Upload Segments
```

### Step 4: Update SecureReaderScreen

Modify `src/pages/SecureReaderScreen.tsx` to:
1. Fetch `table_of_contents` from the content record
2. If TOC exists in DB, use it directly (skip `usePdfOutline`)
3. Fall back to `usePdfOutline` for legacy content without stored TOC

### Step 5: Update Types

Add the TOC type to the Supabase types or create a local interface:

```typescript
interface StoredTableOfContents {
  items: OutlineItem[];
  extractedFrom: 'bookmarks' | 'text';
  extractedAt: string;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/` | Add `table_of_contents` JSONB column |
| `src/lib/pdfTocExtractor.ts` | New file: Extract TOC from full PDF |
| `src/components/admin/ContentUpload.tsx` | Call TOC extractor, save to DB |
| `src/pages/SecureReaderScreen.tsx` | Fetch and use stored TOC |

---

## Technical Details

### TOC Extraction Logic (pdfTocExtractor.ts)

```typescript
import * as pdfjs from 'pdfjs-dist';

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

export async function extractTableOfContents(
  pdfBytes: ArrayBuffer
): Promise<ExtractedToc | null> {
  const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
  
  // Try bookmarks first
  const outline = await pdf.getOutline();
  if (outline && outline.length > 0) {
    const items = await processOutlineItems(pdf, outline);
    return {
      items,
      extractedFrom: 'bookmarks',
      extractedAt: new Date().toISOString(),
    };
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
}
```

### ContentUpload Integration

```typescript
// After reading PDF bytes
setUploadStatus('Extracting table of contents...');
const tocData = await extractTableOfContents(arrayBuffer);

// Include in content insert
const { data: contentData } = await supabase
  .from('content')
  .insert({
    title: title.trim(),
    // ... other fields
    table_of_contents: tocData,
  })
  .select('id')
  .single();
```

### Reader Integration

```typescript
// In SecureReaderScreen
const [storedToc, setStoredToc] = useState<ExtractedToc | null>(null);

// Fetch content with TOC
const { data: contentData } = await supabase
  .from('content')
  .select('*, table_of_contents')
  .eq('id', id)
  .single();

// If stored TOC exists, use it
if (contentData.table_of_contents) {
  setStoredToc(contentData.table_of_contents);
}

// In render - prefer stored TOC over extracted
const effectiveOutline = storedToc?.items || outline;
const effectiveHasOutline = storedToc ? storedToc.items.length > 0 : hasOutline;
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| PDF has no bookmarks or headings | Store `null`, show "No Contents Available" |
| Legacy content (pre-migration) | Fall back to `usePdfOutline` |
| Very long TOC (1000+ items) | JSONB handles this efficiently |
| Re-upload/replace PDF | Update TOC when file is replaced |
| Corrupt PDF during upload | Skip TOC extraction, proceed with upload |

---

## Benefits

1. **Works with segmented PDFs**: Full document is available during upload
2. **Instant TOC loading**: No extraction delay in reader
3. **Low cost**: JSONB is compact, no additional tables
4. **Backward compatible**: Legacy content still uses client extraction
5. **Better accuracy**: Full document means complete heading detection
