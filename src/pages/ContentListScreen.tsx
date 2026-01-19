import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, User, ChevronRight, Library, Clock, CheckCircle, Store, RefreshCw, Sparkles, Crown, BookMarked } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseDialog } from '@/components/library/PurchaseDialog';
import { BookCover } from '@/components/library/BookCover';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatPrice } from '@/lib/currency';

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  price: number;
  currency: string;
  cover_url: string | null;
  category: string | null;
}

interface PurchaseStatus {
  [contentId: string]: 'purchased' | 'pending' | 'rejected' | null;
}

interface ReadingProgress {
  [contentId: string]: number; // percentage 0-100
}

type TabType = 'my-books' | 'store';

export default function ContentListScreen() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>({});
  const [readingProgress, setReadingProgress] = useState<ReadingProgress>({});
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('my-books');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const PULL_THRESHOLD = 80;

  useEffect(() => {
    fetchContent();
  }, [user]);

  const fetchContent = useCallback(async (showRefreshIndicator = false) => {
    if (!user) return;
    
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }
    
    const { data: contentData, error: contentError } = await supabase
      .from('content')
      .select('id, title, description, file_path, price, currency, cover_url, category')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (contentError) {
      console.error('Error fetching content:', contentError);
    } else {
      setContent(contentData || []);
    }

    const { data: accessData } = await supabase
      .from('user_content_access')
      .select('content_id')
      .eq('user_id', user.id);

    const { data: requestData } = await supabase
      .from('purchase_requests')
      .select('content_id, status')
      .eq('user_id', user.id);

    // Fetch reading progress
    const { data: progressData } = await supabase
      .from('reading_progress')
      .select('content_id, current_page, total_pages')
      .eq('user_id', user.id);

    const statusMap: PurchaseStatus = {};
    accessData?.forEach((item) => {
      statusMap[item.content_id] = 'purchased';
    });
    requestData?.forEach((item) => {
      if (!statusMap[item.content_id]) {
        statusMap[item.content_id] = item.status as 'pending' | 'rejected';
      }
    });
    setPurchaseStatus(statusMap);

    // Calculate reading progress percentages
    const progressMap: ReadingProgress = {};
    progressData?.forEach((item) => {
      if (item.total_pages && item.total_pages > 0) {
        progressMap[item.content_id] = Math.round((item.current_page / item.total_pages) * 100);
      }
    });
    setReadingProgress(progressMap);

    setLoading(false);
    setIsRefreshing(false);
  }, [user]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = mainRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    
    const scrollTop = mainRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);
    const dampedDistance = Math.min(distance * 0.5, 120);
    setPullDistance(dampedDistance);
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      fetchContent(true);
    }
    isPulling.current = false;
    setPullDistance(0);
  }, [pullDistance, isRefreshing, fetchContent]);

  const handleContentClick = (item: ContentItem) => {
    const status = purchaseStatus[item.id];
    if (status === 'purchased') {
      navigate(`/reader/${item.id}`);
    } else if (status !== 'pending') {
      setSelectedContent(item);
    }
  };

  const getStatusBadge = (contentId: string) => {
    const status = purchaseStatus[contentId];
    switch (status) {
      case 'purchased':
        return (
          <span className="badge-owned">
            <CheckCircle className="h-3 w-3" />
            Owned
          </span>
        );
      case 'pending':
        return (
          <span className="badge-pending">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const myBooks = content.filter((item) => purchaseStatus[item.id] === 'purchased');
  const storeBooks = content;
  const pendingCount = Object.values(purchaseStatus).filter((s) => s === 'pending').length;

  const displayedContent = activeTab === 'my-books' ? myBooks : storeBooks;

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      {/* Minimal Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/30">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80">
                <BookMarked className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-foreground">Library</h1>
                <p className="text-xs text-muted-foreground">
                  {myBooks.length} owned
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => navigate('/profile')}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 transition-colors hover:bg-muted"
              >
                {profile?.role === 'admin' ? (
                  <Crown className="h-5 w-5 text-gold" />
                ) : (
                  <User className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Modern Segmented Control */}
        <div className="px-4 pb-3">
          <div className="flex p-1 bg-muted/30 rounded-2xl">
            <button
              onClick={() => setActiveTab('my-books')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'my-books'
                  ? 'bg-card text-foreground shadow-premium-md'
                  : 'text-muted-foreground'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>My Books</span>
              {myBooks.length > 0 && (
                <span className={`min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full text-xs font-bold ${
                  activeTab === 'my-books' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {myBooks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('store')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'store'
                  ? 'bg-card text-foreground shadow-premium-md'
                  : 'text-muted-foreground'
              }`}
            >
              <Store className="h-4 w-4" />
              <span>Catalogue</span>
              {pendingCount > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full text-xs font-bold bg-warning text-warning-foreground">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Pull to Refresh Indicator */}
      <div 
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pullDistance > 0 ? pullDistance : 0 }}
      >
        <motion.div
          animate={{ 
            rotate: isRefreshing ? 360 : (pullDistance / PULL_THRESHOLD) * 180,
            scale: Math.min(pullDistance / PULL_THRESHOLD, 1)
          }}
          transition={{ 
            rotate: isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : { duration: 0 }
          }}
        >
          <RefreshCw className={`h-5 w-5 ${pullDistance >= PULL_THRESHOLD ? 'text-primary' : 'text-muted-foreground'}`} />
        </motion.div>
      </div>

      {/* Content */}
      <main 
        ref={mainRef}
        className="flex-1 overflow-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-shimmer rounded-2xl" />
            ))}
          </div>
        ) : displayedContent.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 px-6 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-5">
              {activeTab === 'my-books' ? (
                <Library className="h-8 w-8 text-muted-foreground" />
              ) : (
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              {activeTab === 'my-books' ? 'No Publications Yet' : 'Coming Soon'}
            </h2>
            <p className="mt-2 max-w-[280px] text-sm text-muted-foreground leading-relaxed">
              {activeTab === 'my-books'
                ? "Browse the catalogue to discover publications."
                : 'New publications will appear here.'}
            </p>
            {activeTab === 'my-books' && storeBooks.length > 0 && (
              <button
                onClick={() => setActiveTab('store')}
                className="mt-5 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm shadow-premium-md active:scale-[0.98] transition-transform"
              >
                Browse Catalogue
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-4 space-y-3"
            >
              {displayedContent.map((item, index) => {
                const status = purchaseStatus[item.id];
                const isPurchased = status === 'purchased';
                const isPending = status === 'pending';
                const progress = readingProgress[item.id] || 0;
                
                if (activeTab === 'my-books' && !isPurchased) return null;
                
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.2 }}
                    onClick={() => handleContentClick(item)}
                    disabled={isPending}
                    className={`group w-full flex items-center gap-4 p-3 rounded-2xl bg-card border text-left transition-all duration-200 active:scale-[0.98] ${
                      isPending 
                        ? 'opacity-50 cursor-not-allowed border-border/30' 
                        : isPurchased
                          ? 'border-border/50 hover:border-primary/30'
                          : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    {/* Book Cover */}
                    <BookCover 
                      coverUrl={item.cover_url} 
                      title={item.title} 
                      isOwned={isPurchased}
                      progress={progress}
                      category={item.category || undefined}
                      size="lg"
                    />

                    {/* Content */}
                    <div className="min-w-0 flex-1 py-1">
                      <h3 className="font-medium text-base text-foreground leading-snug line-clamp-2">
                        {item.title}
                      </h3>
                      
                      {/* Progress or Status */}
                      <div className="mt-2 flex items-center gap-2">
                        {activeTab === 'my-books' ? (
                          progress > 0 && progress < 100 ? (
                            <div className="flex items-center gap-2 flex-1">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-gold to-gold/80 rounded-full transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
                            </div>
                          ) : progress === 100 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Completed
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Start reading</span>
                          )
                        ) : (
                          <>
                            {getStatusBadge(item.id)}
                            {!status && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary">
                                {formatPrice(item.price)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight className={`h-5 w-5 flex-shrink-0 transition-all ${
                      isPurchased 
                        ? 'text-primary' 
                        : 'text-muted-foreground/50'
                    }`} />
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Purchase Dialog */}
      <PurchaseDialog
        content={selectedContent}
        onClose={() => setSelectedContent(null)}
        onPurchaseSubmitted={fetchContent}
      />
    </div>
  );
}
