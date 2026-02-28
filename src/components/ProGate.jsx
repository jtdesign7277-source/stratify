import { useAuth } from '../context/AuthContext';
import useSubscription from '../hooks/useSubscription';
import UpgradePrompt from './UpgradePrompt';

export default function ProGate({ children, featureName, description }) {
  const { user } = useAuth();
  const { isProUser, loading } = useSubscription(user);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-transparent text-white/50">
        Loading...
      </div>
    );
  }

  if (isProUser) {
    return children;
  }

  return (
    <div className="h-full w-full flex items-center justify-center">
      <UpgradePrompt
        featureName={featureName}
        description={description}
      />
    </div>
  );
}
