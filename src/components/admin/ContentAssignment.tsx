import { useState, useEffect } from 'react';
import { X, UserPlus, UserMinus, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Content {
  id: string;
  title: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  has_access: boolean;
}

interface ContentAssignmentProps {
  content: Content | null;
  onClose: () => void;
}

export function ContentAssignment({ content, onClose }: ContentAssignmentProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (content) {
      fetchUsersAndAccess();
    }
  }, [content]);

  const fetchUsersAndAccess = async () => {
    if (!content) return;
    setLoading(true);

    // Fetch all non-admin users
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, name, has_access')
      .neq('role', 'admin')
      .order('email');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Fetch assigned users for this content
    const { data: accessData, error: accessError } = await supabase
      .from('user_content_access')
      .select('user_id')
      .eq('content_id', content.id);

    if (accessError) {
      console.error('Error fetching access:', accessError);
    }

    setUsers(usersData || []);
    setAssignedUserIds(new Set((accessData || []).map((a) => a.user_id)));
    setLoading(false);
  };

  const toggleAccess = async (userId: string) => {
    if (!content) return;
    setUpdating(userId);

    const isCurrentlyAssigned = assignedUserIds.has(userId);

    try {
      if (isCurrentlyAssigned) {
        // Remove access
        const { error } = await supabase
          .from('user_content_access')
          .delete()
          .eq('content_id', content.id)
          .eq('user_id', userId);

        if (error) throw error;

        setAssignedUserIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        toast({ title: 'Success', description: 'Access removed' });
      } else {
        // Grant access
        const { error } = await supabase.from('user_content_access').insert({
          content_id: content.id,
          user_id: userId,
        });

        if (error) throw error;

        setAssignedUserIds((prev) => new Set(prev).add(userId));
        toast({ title: 'Success', description: 'Access granted' });
      }
    } catch (error) {
      console.error('Toggle access error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update access',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const assignToAll = async () => {
    if (!content) return;
    setUpdating('all');

    try {
      // Get users not yet assigned
      const unassignedUsers = users.filter((u) => !assignedUserIds.has(u.id));
      
      if (unassignedUsers.length === 0) {
        toast({ title: 'Info', description: 'All users already have access' });
        return;
      }

      const { error } = await supabase.from('user_content_access').insert(
        unassignedUsers.map((u) => ({
          content_id: content.id,
          user_id: u.id,
        }))
      );

      if (error) throw error;

      setAssignedUserIds(new Set(users.map((u) => u.id)));
      toast({ title: 'Success', description: `Access granted to ${unassignedUsers.length} users` });
    } catch (error) {
      console.error('Assign all error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const revokeFromAll = async () => {
    if (!content) return;
    setUpdating('none');

    try {
      const { error } = await supabase
        .from('user_content_access')
        .delete()
        .eq('content_id', content.id);

      if (error) throw error;

      setAssignedUserIds(new Set());
      toast({ title: 'Success', description: 'Access revoked from all users' });
    } catch (error) {
      console.error('Revoke all error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Sheet open={!!content} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-left">
            Manage Access: {content?.title}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Bulk Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={assignToAll}
              disabled={updating !== null}
              className="flex-1"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Assign All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={revokeFromAll}
              disabled={updating !== null}
              className="flex-1"
            >
              <UserMinus className="mr-2 h-4 w-4" />
              Revoke All
            </Button>
          </div>

          {/* User List */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users available
              </div>
            ) : (
              users.map((user) => {
                const isAssigned = assignedUserIds.has(user.id);
                const isUpdatingThis = updating === user.id;

                return (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                      isAssigned ? 'border-success/50 bg-success/5' : 'border-border'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{user.name || user.email}</p>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      {!user.has_access && (
                        <span className="text-xs text-warning">App access pending</span>
                      )}
                    </div>
                    <Button
                      variant={isAssigned ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleAccess(user.id)}
                      disabled={updating !== null}
                    >
                      {isUpdatingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isAssigned ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {/* Summary */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              {assignedUserIds.size} of {users.length} users have access
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
