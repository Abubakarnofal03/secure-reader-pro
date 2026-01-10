import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronsLeft, ChevronsRight, ArrowRight } from 'lucide-react';

interface GoToPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  recentPages?: number[];
}

export function GoToPageDialog({
  open,
  onOpenChange,
  currentPage,
  totalPages,
  onPageChange,
  recentPages = [],
}: GoToPageDialogProps) {
  const [inputValue, setInputValue] = useState(currentPage.toString());
  const [error, setError] = useState<string | null>(null);

  // Reset input when dialog opens
  useEffect(() => {
    if (open) {
      setInputValue(currentPage.toString());
      setError(null);
    }
  }, [open, currentPage]);

  const validateAndGo = useCallback(() => {
    const page = parseInt(inputValue, 10);
    
    if (isNaN(page)) {
      setError('Please enter a valid number');
      return;
    }
    
    if (page < 1) {
      setError('Page must be at least 1');
      return;
    }
    
    if (page > totalPages) {
      setError(`Page cannot exceed ${totalPages}`);
      return;
    }
    
    setError(null);
    onPageChange(page);
    onOpenChange(false);
  }, [inputValue, totalPages, onPageChange, onOpenChange]);

  const goToFirstPage = useCallback(() => {
    onPageChange(1);
    onOpenChange(false);
  }, [onPageChange, onOpenChange]);

  const goToLastPage = useCallback(() => {
    onPageChange(totalPages);
    onOpenChange(false);
  }, [totalPages, onPageChange, onOpenChange]);

  const goToRecentPage = useCallback(
    (page: number) => {
      onPageChange(page);
      onOpenChange(false);
    },
    [onPageChange, onOpenChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        validateAndGo();
      }
    },
    [validateAndGo]
  );

  // Filter recent pages to exclude current page and duplicates
  const filteredRecentPages = recentPages
    .filter((page, index, arr) => 
      page !== currentPage && 
      page >= 1 && 
      page <= totalPages &&
      arr.indexOf(page) === index
    )
    .slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle className="text-center">Go to Page</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10"
              onClick={goToFirstPage}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4 mr-1" />
              First
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-10"
              onClick={goToLastPage}
              disabled={currentPage === totalPages}
            >
              Last
              <ChevronsRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Page Input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="number"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                min={1}
                max={totalPages}
                placeholder="Enter page number"
                className="flex-1 text-center text-lg"
                autoFocus
              />
              <Button onClick={validateAndGo} className="px-4">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            
            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
            
            <p className="text-xs text-muted-foreground text-center">
              of {totalPages} pages
            </p>
          </div>

          {/* Recent Pages */}
          {filteredRecentPages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Recent pages:</p>
              <div className="flex flex-wrap gap-2">
                {filteredRecentPages.map((page) => (
                  <Button
                    key={page}
                    variant="secondary"
                    size="sm"
                    onClick={() => goToRecentPage(page)}
                    className="h-8 min-w-[3rem]"
                  >
                    {page}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Progress indicator */}
          <div className="pt-2">
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(currentPage / totalPages) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">
              {Math.round((currentPage / totalPages) * 100)}% complete
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
