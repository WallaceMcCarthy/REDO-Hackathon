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
        <div className="flex items-center gap-2 h-9 rounded-full border border-rock-100 bg-sand/95 px-4 text-ink shadow-sm">
          <span className="max-w-32 truncate font-semibold">{me?.displayName ?? 'Account'}</span>
          <button onClick={() => void signOut()} className="font-semibold text-alpine-700 underline hover:text-alpine-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500">
            Sign out
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          className="h-9 cursor-pointer rounded-full bg-rock-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rock-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500"
        >
          Sign in
        </button>
      )}
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
