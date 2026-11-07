import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button } from '../ui/Button';
import AuthModal from './AuthModal';

const OPEN_SIGN_IN = 'utah-fit:open-sign-in';
/** Lets any screen open the sign-in modal without threading state through App. */
export const openSignIn = () => window.dispatchEvent(new Event(OPEN_SIGN_IN));

/** Account control for AppHeader: "Sign in" when signed out, name + sign out when signed in. */
export default function AccountMenu() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const me = useQuery(api.profiles.getMe, isAuthenticated ? {} : 'skip');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const open = () => setShowModal(true);
    window.addEventListener(OPEN_SIGN_IN, open);
    return () => window.removeEventListener(OPEN_SIGN_IN, open);
  }, []);

  return (
    <div className="ml-auto flex min-w-0 items-center gap-2 sm:ml-0">
      {isLoading ? null : isAuthenticated ? (
        <div className="flex items-center gap-1 rounded-pill border border-border bg-surface pl-4 text-small text-text">
          <a href="#/account" className="flex min-h-11 max-w-16 items-center sm:max-w-32 font-semibold text-text no-underline hover:underline"><span className="truncate">{me?.displayName ?? 'Account'}</span></a>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => setShowModal(true)}>Sign in</Button>
      )}
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
