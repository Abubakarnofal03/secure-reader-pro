import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireAccess?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireAccess = true 
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile) {
    return <LoadingScreen />;
  }

  // Admin routes
  if (requireAdmin && profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Regular users can now access the library without global access check
  // Access is controlled per-book via purchase system

  return <>{children}</>;
}
