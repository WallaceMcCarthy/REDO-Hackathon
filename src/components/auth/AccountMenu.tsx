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

/** Account control: "Sign in" when signed out, name + sign out when signed in. `inline` is for AppHeader; without it the menu floats top right on screens that have no AppHeader yet. */
export default function AccountMenu({ inline = false }: { inline?: boolean }) {
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
    <div className={inline ? 'flex items-center gap-2' : 'fixed right-3 top-3 z-40 flex items-center gap-2 text-sm'}>
      {!inline && (
        <a href="#/roommates" className="rounded-full bg-white/90 px-3 py-1.5 font-medium shadow dark:bg-neutral-900/90">
          Roommates
        </a>
      )}
      {isLoading ? null : isAuthenticated ? (
        <div className="flex items-center gap-1 rounded-pill border border-border bg-surface pl-4 text-small text-text">
          <span className="max-w-32 truncate font-semibold">{me?.displayName ?? 'Account'}</span>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => setShowModal(true)}>Sign in</Button>
      )}
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
