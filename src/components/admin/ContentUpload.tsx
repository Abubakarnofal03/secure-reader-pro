import { useState, useRef } from 'react';
import { Upload, FileUp, X, Loader2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CoverUpload } from './CoverUpload';
import { CONTENT_CATEGORIES, getCategoryConfig } from '@/lib/categories';
import { extractTableOfContents } from '@/lib/pdfTocExtractor';

interface ContentUploadProps {
  onSuccess: () => void;
}

// Number of pages per segment
const PAGES_PER_SEGMENT = 50;

export function ContentUpload({ onSuccess }: ContentUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('general');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
        return;
      }
      // Warn for very large files but don't prevent
      if (file.size > 100 * 1024 * 1024) { // 100MB
        toast({ 
          title: 'Large File Detected', 
          description: 'This file will be split into segments for optimal performance.', 
        });
      }
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace('.pdf', ''));
      }
    }
  };

  const splitPdfIntoSegments = async (pdfBytes: ArrayBuffer): Promise<{ segment: Uint8Array; startPage: number; endPage: number }[]> => {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    const segments: { segment: Uint8Array; startPage: number; endPage: number }[] = [];

    for (let startIdx = 0; startIdx < totalPages; startIdx += PAGES_PER_SEGMENT) {
      const endIdx = Math.min(startIdx + PAGES_PER_SEGMENT - 1, totalPages - 1);
      
      // Create a new document for this segment
      const segmentDoc = await PDFDocument.create();
      
      // Copy pages from original document
      const pageIndices = [];
      for (let i = startIdx; i <= endIdx; i++) {
        pageIndices.push(i);
      }
      
      const copiedPages = await segmentDoc.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach((page) => {
        segmentDoc.addPage(page);
      });

      // Save segment as bytes
      const segmentBytes = await segmentDoc.save();
      
      segments.push({
        segment: segmentBytes,
        startPage: startIdx + 1, // 1-indexed for user-facing page numbers
        endPage: endIdx + 1,
      });
    }

    return segments;
  };

  const uploadSegment = async (
    segmentBytes: Uint8Array,
    contentId: string,
    segmentIndex: number,
    accessToken: string
  ): Promise<string> => {
    const fileName = `segment_${segmentIndex}.pdf`;
    const filePath = `${contentId}/${fileName}`;
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(filePath);
        } else {
          try {
            const response = JSON.parse(xhr.responseText);
            reject(new Error(response.message || response.error || 'Upload failed'));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('POST', `${supabaseUrl}/storage/v1/object/content-files/${filePath}`);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('Content-Type', 'application/pdf');
      xhr.setRequestHeader('x-upsert', 'false');
      // Create a new Uint8Array copy to ensure we have a proper ArrayBuffer
      const copy = new Uint8Array(segmentBytes);
      xhr.send(new Blob([copy], { type: 'application/pdf' }));
    });
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim() || !price.trim()) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      toast({ title: 'Error', description: 'Please enter a valid price', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('Reading PDF...');
    
    let contentId: string | null = null;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Read the PDF file
      setUploadProgress(5);
      const arrayBuffer = await selectedFile.arrayBuffer();
      
      // Extract Table of Contents from full PDF before splitting
      // Create a copy because pdfjs detaches the ArrayBuffer during TOC extraction
      setUploadStatus('Extracting table of contents...');
      setUploadProgress(8);
      let tocData = null;
      try {
        const tocArrayBuffer = arrayBuffer.slice(0);
        tocData = await extractTableOfContents(tocArrayBuffer);
        if (tocData) {
          console.log(`[ContentUpload] Extracted TOC with ${tocData.items.length} items (${tocData.extractedFrom})`);
        } else {
          console.log('[ContentUpload] No TOC found in PDF');
        }
      } catch (tocError) {
        console.warn('[ContentUpload] TOC extraction failed, continuing without:', tocError);
      }
      
      // Split into segments
      setUploadStatus('Splitting PDF into segments...');
      setUploadProgress(12);
      const segments = await splitPdfIntoSegments(arrayBuffer);
      const totalPages = segments.reduce((max, seg) => Math.max(max, seg.endPage), 0);
      
      console.log(`[ContentUpload] Split PDF into ${segments.length} segments, ${totalPages} total pages`);

      // Create content record first to get the ID (with TOC)
      setUploadStatus('Creating content record...');
      setUploadProgress(18);
      
      const { data: contentData, error: insertError } = await supabase
        .from('content')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          file_path: 'segmented', // Placeholder - actual files are in segments
          is_active: true,
          price: priceValue,
          currency: 'PKR',
          cover_url: coverUrl,
          category: category,
          total_pages: totalPages,
          table_of_contents: tocData,
        })
        .select('id')
        .single();

      if (insertError || !contentData) {
        throw new Error(`Failed to create content record: ${insertError?.message || 'Unknown error'}`);
      }

      contentId = contentData.id;
      console.log(`[ContentUpload] Created content record: ${contentId}`);

      // Upload each segment
      const segmentUploadProgress = 77 / segments.length; // 77% for uploads (18-95%)
      
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        setUploadStatus(`Uploading segment ${i + 1} of ${segments.length}...`);
        
        // Upload segment file
        const filePath = await uploadSegment(
          seg.segment,
          contentId,
          i,
          session.access_token
        );

        // Insert segment record
        const { error: segmentInsertError } = await supabase
          .from('content_segments')
          .insert({
            content_id: contentId,
            segment_index: i,
            start_page: seg.startPage,
            end_page: seg.endPage,
            file_path: filePath,
          });

        if (segmentInsertError) {
          throw new Error(`Failed to create segment record: ${segmentInsertError.message}`);
        }

        setUploadProgress(18 + Math.round((i + 1) * segmentUploadProgress));
      }

      setUploadStatus('Finalizing...');
      setUploadProgress(100);

      toast({ 
        title: 'Success', 
        description: `Content uploaded successfully (${segments.length} segments, ${totalPages} pages)` 
      });
      
      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setPrice('');
      setCategory('general');
      setCoverUrl(null);
      setUploadProgress(0);
      setUploadStatus('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      onSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      
      // Cleanup: Delete content record if created (segments will cascade delete)
      if (contentId) {
        try {
          await supabase.from('content').delete().eq('id', contentId);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }
      
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4 rounded-xl bg-card p-4 border border-border">
      <h3 className="flex items-center gap-2 font-semibold font-display">
        <Upload className="h-5 w-5" />
        Upload New Publication
      </h3>

      <div className="grid grid-cols-[auto_1fr] gap-4">

        {/* Cover Upload */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Cover Image</Label>
          <CoverUpload coverUrl={coverUrl} onCoverChange={setCoverUrl} disabled={uploading} />
        </div>

        <div className="space-y-3">
        {/* File Selection */}
        <div>
          <Label htmlFor="file">PDF File</Label>
          <div className="mt-1.5">
            {selectedFile ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary p-3 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  <FileUp className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="truncate text-sm flex-1 min-w-0">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSelection} disabled={uploading} className="flex-shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 hover:border-primary hover:bg-secondary/50 transition-colors"
              >
                <FileUp className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to select PDF file</span>
                <span className="text-xs text-muted-foreground mt-1">Large files will be automatically split</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Title */}
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter content title"
            className="mt-1.5"
            disabled={uploading}
          />
        </div>

        {/* Price */}
        <div>
          <Label htmlFor="price">Price (Rs) *</Label>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              Rs
            </span>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="pl-10"
              disabled={uploading}
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory} disabled={uploading}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select category">
                {(() => {
                  const config = getCategoryConfig(category);
                  const IconComponent = config.icon;
                  return (
                    <span className="flex items-center gap-2">
                      <IconComponent className={`h-4 w-4 ${config.color}`} />
                      {config.label}
                    </span>
                  );
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CONTENT_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <IconComponent className={`h-4 w-4 ${cat.color}`} />
                      {cat.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a description"
            rows={2}
            className="mt-1.5"
            disabled={uploading}
          />
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{uploadStatus || 'Uploading...'}</span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || !title.trim() || !price.trim() || uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploadStatus || `Uploading... ${uploadProgress}%`}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Content
            </>
          )}
        </Button>
        </div>
      </div>
    </div>
  );
}
