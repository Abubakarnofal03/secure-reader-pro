import { memo, useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StickyNote, Trash2, Edit3, Plus, FileText } from 'lucide-react';
import { UserNote } from '@/hooks/useUserNotes';
import { AddNoteDialog } from './AddNoteDialog';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface NotesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notes: UserNote[];
  currentPage: number;
  onNavigate: (page: number) => void;
  onAddNote: (pageNumber: number, noteText: string) => Promise<UserNote | null>;
  onUpdateNote: (noteId: string, noteText: string) => Promise<boolean>;
  onDeleteNote: (noteId: string) => Promise<boolean>;
  isLoading: boolean;
  isSaving: boolean;
}

// Group notes by page for display
function groupNotesByPage(notes: UserNote[]): Map<number, UserNote[]> {
  const grouped = new Map<number, UserNote[]>();
  notes.forEach((note) => {
    const pageNotes = grouped.get(note.page_number) || [];
    pageNotes.push(note);
    grouped.set(note.page_number, pageNotes);
  });
  return grouped;
}

export const NotesPanel = memo(function NotesPanel({
  isOpen,
  onClose,
  notes,
  currentPage,
  onNavigate,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  isLoading,
  isSaving,
}: NotesPanelProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<UserNote | null>(null);
  const [deleteConfirmNote, setDeleteConfirmNote] = useState<UserNote | null>(null);

  const groupedNotes = groupNotesByPage(notes);
  const sortedPages = Array.from(groupedNotes.keys()).sort((a, b) => a - b);

  const handleAddNote = useCallback(async (pageNumber: number, noteText: string) => {
    const result = await onAddNote(pageNumber, noteText);
    if (result) {
      setShowAddDialog(false);
    }
    return result;
  }, [onAddNote]);

  const handleEditNote = useCallback(async (noteId: string, noteText: string) => {
    const success = await onUpdateNote(noteId, noteText);
    if (success) {
      setEditingNote(null);
    }
    return success ? ({ id: noteId } as UserNote) : null;
  }, [onUpdateNote]);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirmNote) {
      await onDeleteNote(deleteConfirmNote.id);
      setDeleteConfirmNote(null);
    }
  }, [deleteConfirmNote, onDeleteNote]);

  const handlePageClick = useCallback((page: number) => {
    onNavigate(page);
    onClose();
  }, [onNavigate, onClose]);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-[85vw] max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5 text-primary" />
                My Notes
              </SheetTitle>
              <Button
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground mb-1">No notes yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Add notes to remember important points
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowAddDialog(true)}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Note
                </Button>
              </div>
            ) : (
              <div className="p-2">
                {sortedPages.map((pageNumber) => (
                  <div key={pageNumber} className="mb-4">
                    <button
                      onClick={() => handlePageClick(pageNumber)}
                      className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-lg mb-2 text-xs font-medium w-full
                        transition-colors hover:bg-primary/10
                        ${currentPage === pageNumber 
                          ? 'bg-primary/15 text-primary' 
                          : 'bg-muted text-muted-foreground'
                        }
                      `}
                    >
                      Page {pageNumber}
                      <span className="ml-auto text-[10px] opacity-70">
                        {groupedNotes.get(pageNumber)?.length} note{(groupedNotes.get(pageNumber)?.length || 0) > 1 ? 's' : ''}
                      </span>
                    </button>
                    
                    <div className="space-y-2">
                      {groupedNotes.get(pageNumber)?.map((note) => (
                        <div
                          key={note.id}
                          className="bg-card border border-border rounded-lg p-3 group"
                        >
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {note.note_text}
                          </p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingNote(note)}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                                title="Edit note"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmNote(note)}
                                className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                                title="Delete note"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Add Note Dialog */}
      <AddNoteDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSave={handleAddNote}
        currentPage={currentPage}
        isSaving={isSaving}
      />

      {/* Edit Note Dialog */}
      {editingNote && (
        <AddNoteDialog
          isOpen={true}
          onClose={() => setEditingNote(null)}
          onSave={(_, text) => handleEditNote(editingNote.id, text)}
          currentPage={editingNote.page_number}
          isSaving={isSaving}
          initialText={editingNote.note_text}
          isEditing
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog 
        open={!!deleteConfirmNote} 
        onOpenChange={(open) => !open && setDeleteConfirmNote(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
