import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, User, ChevronRight, Library } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
}

export default function ContentListScreen() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    const { data, error } = await supabase
      .from('content')
      .select('id, title, description, file_path')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching content:', error);
    } else {
      setContent(data || []);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">My Library</h1>
              <p className="text-xs text-muted-foreground">
                {content.length} {content.length === 1 ? 'publication' : 'publications'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
          >
            <User className="h-5 w-5 text-secondary-foreground" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        ) : content.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Library className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              No Content Yet
            </h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Content assigned to you by an administrator will appear here.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {content.map((item, index) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => navigate(`/reader/${item.id}`)}
                className="flex w-full items-center gap-4 rounded-xl bg-card p-4 text-left transition-colors hover:bg-secondary"
              >
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-foreground">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              </motion.button>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}
