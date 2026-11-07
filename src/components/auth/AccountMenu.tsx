import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import AuthModal from './AuthModal';

const OPEN_SIGN_IN = 'utah-fit:open-sign-in';
/** Lets any screen open the sign-in modal without threading state through App. */
export const openSignIn = () => window.dispatchEvent(new Event(OPEN_SIGN_IN));

/** Fixed header account control: "Sign in" when signed out, name + sign out when signed in. */
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
    <div className="fixed right-3 top-3 z-40 flex items-center gap-2 text-sm">
      <a href="#/roommates" className="rounded-full bg-white/90 px-3 py-1.5 font-medium shadow dark:bg-neutral-900/90">
        Roommates
      </a>
      {isLoading ? null : isAuthenticated ? (
        <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow dark:bg-neutral-900/90">
          <a href="#/account" className="font-medium">{me?.displayName ?? 'Account'}</a>
          <button onClick={() => void signOut()} className="text-neutral-500 underline">
            Sign out
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          className="rounded-full bg-white/90 px-3 py-1.5 font-medium shadow dark:bg-neutral-900/90"
        >
          Sign in
        </button>
      )}
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
