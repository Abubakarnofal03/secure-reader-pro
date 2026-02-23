import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Loader2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { TocItem } from '@/lib/pdfTocExtractor';
import type { Json } from '@/integrations/supabase/types';

interface TocEditorProps {
  contentId: string | null;
  contentTitle: string;
  onClose: () => void;
}

interface TocData {
  items: TocItem[];
  extractedFrom: string;
  extractedAt: string;
}

export function TocEditor({ contentId, contentTitle, onClose }: TocEditorProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<TocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPage, setNewPage] = useState('');

  useEffect(() => {
    if (contentId) {
      fetchToc();
    } else {
      setItems([]);
    }
  }, [contentId]);

  const fetchToc = async () => {
    if (!contentId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('content')
      .select('table_of_contents')
      .eq('id', contentId)
      .single();

    if (!error && data?.table_of_contents) {
      const toc = data.table_of_contents as unknown as TocData;
      setItems(toc.items || []);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    const page = parseInt(newPage);
    if (!newTitle.trim() || isNaN(page) || page < 1) {
      toast({ title: 'Invalid entry', description: 'Enter a title and valid page number', variant: 'destructive' });
      return;
    }
    const newItem: TocItem = { title: newTitle.trim(), pageNumber: page, isManual: true };
    const updated = [...items, newItem].sort((a, b) => a.pageNumber - b.pageNumber);
    setItems(updated);
    setNewTitle('');
    setNewPage('');
  };

  const handleRemove = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!contentId) return;
    setSaving(true);

    const tocData: TocData = {
      items,
      extractedFrom: 'manual',
      extractedAt: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('content')
      .update({ table_of_contents: tocData as unknown as Json })
      .eq('id', contentId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to save TOC', variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Table of Contents updated' });
      onClose();
    }
    setSaving(false);
  };

  return (
    <Sheet open={!!contentId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Table of Contents
          </SheetTitle>
          <SheetDescription className="truncate">{contentTitle}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Add new entry */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <Label className="text-sm font-medium">Add Entry</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Chapter title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <Input
                  placeholder="Page"
                  type="number"
                  min={1}
                  value={newPage}
                  onChange={(e) => setNewPage(e.target.value)}
                  className="w-20"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <Button size="icon" onClick={handleAdd} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* TOC list */}
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                Entries ({items.length})
              </Label>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No TOC entries. Add manually or re-upload to auto-extract.
                </p>
              ) : (
                <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                  {items.map((item, index) => (
                    <div
                      key={`${item.pageNumber}-${index}`}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/50 hover:bg-muted transition-colors group"
                    >
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                      <span className="text-sm flex-1 truncate">{item.title}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                        p.{item.pageNumber}
                      </span>
                      {item.isManual && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full flex-shrink-0">
                          manual
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => handleRemove(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save */}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Table of Contents
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
