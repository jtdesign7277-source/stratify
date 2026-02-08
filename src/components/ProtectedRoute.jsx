import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace('/auth');
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          Loading secure session...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
};

export default ProtectedRoute;
