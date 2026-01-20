import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, FileText, BookOpen, Loader2 } from 'lucide-react';
import { OutlineItem } from '@/hooks/usePdfOutline';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCategoryConfig } from '@/lib/categories';

interface TableOfContentsProps {
  isOpen: boolean;
  onClose: () => void;
  outline: OutlineItem[];
  currentPage: number;
  onNavigate: (page: number) => void;
  hasOutline: boolean;
  isLoading?: boolean;
  category?: string;
}

interface OutlineItemRowProps {
  item: OutlineItem;
  currentPage: number;
  onNavigate: (page: number) => void;
  depth?: number;
}

function OutlineItemRow({ item, currentPage, onNavigate, depth = 0 }: OutlineItemRowProps) {
  const isActive = currentPage === item.pageNumber;
  const hasChildren = item.items && item.items.length > 0;

  return (
    <div>
      <button
        onClick={() => onNavigate(item.pageNumber)}
        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary border-l-2 border-primary'
            : 'hover:bg-muted/50'
        }`}
        style={{ paddingLeft: `${16 + depth * 16}px` }}
      >
        <ChevronRight className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className={`flex-1 text-sm ${isActive ? 'font-medium' : ''}`}>
          {item.title}
        </span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {item.pageNumber}
        </span>
      </button>
      
      {hasChildren && (
        <div className="border-l border-border/50 ml-6">
          {item.items!.map((child, index) => (
            <OutlineItemRow
              key={`${child.title}-${index}`}
              item={child}
              currentPage={currentPage}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TableOfContents({
  isOpen,
  onClose,
  outline,
  currentPage,
  onNavigate,
  hasOutline,
  isLoading = false,
  category,
}: TableOfContentsProps) {
  const handleNavigate = (page: number) => {
    onNavigate(page);
    onClose();
  };

  const categoryConfig = category ? getCategoryConfig(category) : null;
  const CategoryIcon = categoryConfig?.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] bg-background border-r border-border shadow-2xl flex flex-col safe-top safe-bottom"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                {CategoryIcon ? (
                  <CategoryIcon className={`h-5 w-5 ${categoryConfig?.color || 'text-primary'}`} />
                ) : (
                  <BookOpen className="h-5 w-5 text-primary" />
                )}
                <div>
                  <h2 className="font-semibold text-foreground">Contents</h2>
                  {categoryConfig && (
                    <p className={`text-xs ${categoryConfig.color}`}>{categoryConfig.label}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <h3 className="font-medium text-foreground mb-2">Building Contents</h3>
                  <p className="text-sm text-muted-foreground">
                    Extracting headings from the document...
                  </p>
                </div>
              ) : hasOutline ? (
                <div className="py-2">
                  {outline.map((item, index) => (
                    <OutlineItemRow
                      key={`${item.title}-${index}`}
                      item={item}
                      currentPage={currentPage}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                    <FileText className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-2">No Contents Available</h3>
                  <p className="text-sm text-muted-foreground">
                    This document doesn't have a table of contents. 
                    Use the page navigation to jump to specific pages.
                  </p>
                </div>
              )}
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
