import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Library, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseDialog } from '@/components/library/PurchaseDialog';
import { LibraryBookItem } from '@/components/library/LibraryBookItem';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import logo from '@/assets/logo.png';

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

  const myBooks = content.filter((item) => purchaseStatus[item.id] === 'purchased');
  const storeBooks = content;

  const displayedContent = activeTab === 'my-books' ? myBooks : storeBooks;

  // Get user initials for avatar
  const getUserInitial = () => {
    if (profile?.name) return profile.name.charAt(0).toUpperCase();
    if (profile?.email) return profile.email.charAt(0).toUpperCase();
    return 'U';
  };

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <img src={logo} alt="Calorics" className="h-9 w-9 rounded-lg" />
              <span className="text-xl font-semibold text-foreground tracking-tight">
                Calorics
              </span>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                onClick={() => navigate('/profile')}
                className="h-8 w-8 rounded-full transition-colors hover:bg-muted/50"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {getUserInitial()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('my-books')}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === 'my-books'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              Library
              {activeTab === 'my-books' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('store')}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === 'store'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              Store
              {activeTab === 'store' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
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
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-shimmer rounded-xl" />
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
                className="mt-5 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm shadow-md active:scale-[0.98] transition-transform"
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
                const progress = readingProgress[item.id] || 0;
                
                if (activeTab === 'my-books' && !isPurchased) return null;
                
                return (
                  <LibraryBookItem
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    coverUrl={item.cover_url}
                    category={item.category}
                    price={item.price}
                    currency={item.currency}
                    status={status}
                    progress={progress}
                    onClick={() => handleContentClick(item)}
                    index={index}
                    showInMyBooks={activeTab === 'my-books'}
                  />
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
