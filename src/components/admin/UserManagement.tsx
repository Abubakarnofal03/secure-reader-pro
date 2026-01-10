import { useState, useEffect } from 'react';
import { UserCheck, UserX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  has_access: boolean;
  role: string;
  created_at: string;
}

export function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const toggleAccess = async (userId: string, currentAccess: boolean) => {
    setUpdating(userId);
    
    const { error } = await supabase
      .from('profiles')
      .update({ has_access: !currentAccess })
      .eq('id', userId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ 
        title: 'Success', 
        description: `Access ${!currentAccess ? 'granted' : 'revoked'}` 
      });
      fetchUsers();
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between rounded-xl bg-card p-4 border border-border"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{user.name || user.email}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  user.has_access
                    ? 'bg-success/10 text-success'
                    : 'bg-warning/10 text-warning'
                }`}
              >
                {user.has_access ? 'Has Access' : 'Pending'}
              </span>
              {user.role === 'admin' && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Admin
                </span>
              )}
            </div>
          </div>
          {user.role !== 'admin' && (
            <Button
              variant={user.has_access ? 'destructive' : 'default'}
              size="sm"
              onClick={() => toggleAccess(user.id, user.has_access)}
              disabled={updating === user.id}
            >
              {updating === user.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : user.has_access ? (
                <UserX className="h-4 w-4" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
