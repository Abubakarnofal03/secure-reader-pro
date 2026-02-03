import { memo, useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface AddNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pageNumber: number, noteText: string) => Promise<unknown>;
  currentPage: number;
  isSaving: boolean;
  initialText?: string;
  isEditing?: boolean;
}

export const AddNoteDialog = memo(function AddNoteDialog({
  isOpen,
  onClose,
  onSave,
  currentPage,
  isSaving,
  initialText = '',
  isEditing = false,
}: AddNoteDialogProps) {
  const [pageNumber, setPageNumber] = useState(currentPage);
  const [noteText, setNoteText] = useState(initialText);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPageNumber(currentPage);
      setNoteText(initialText);
    }
  }, [isOpen, currentPage, initialText]);

  const handleSave = useCallback(async () => {
    if (!noteText.trim()) return;
    await onSave(pageNumber, noteText.trim());
  }, [pageNumber, noteText, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Note' : 'Add Note'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="page-number">Page Number</Label>
              <Input
                id="page-number"
                type="number"
                min={1}
                value={pageNumber}
                onChange={(e) => setPageNumber(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note-text">Note</Label>
            <Textarea
              id="note-text"
              placeholder="Write your note here..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[120px] resize-none"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Press ⌘+Enter to save
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!noteText.trim() || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : isEditing ? (
              'Update Note'
            ) : (
              'Add Note'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
