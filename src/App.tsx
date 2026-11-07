import { useEffect, useState } from 'react';
import { defaultPrefs } from './prefs';
import { openSignIn } from './components/auth/AccountMenu';
import Account from './screens/Account';
import Quiz from './screens/Quiz';
import Results from './screens/Results';
import Roommates from './screens/Roommates';
import SavedPlaces from './screens/SavedPlaces';
import { AppHeader } from './components/ui';
import TownDetail from './screens/TownDetail';
import AdsSandboxCheckout from './screens/AdsSandboxCheckout';
import UiKit from './screens/UiKit';
import type { Prefs } from './types';

const readHash = () => window.location.hash.replace(/^#\/?/, '');
export const go = (path: string) => { window.location.hash = `/${path}`; };

export default function App() {
  const [route, setRoute] = useState(readHash);
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);

  useEffect(() => {
    const onChange = () => { setRoute(readHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const town = route.match(/^town\/(.+)$/)?.[1];
  const isAdsCheckout = route.startsWith('ads-sandbox-checkout');

  return (
    <>
      {route !== 'ui' && <AppHeader route={route} />}
      {route === 'ui' ? (
        <UiKit />
      ) : town ? (
        <TownDetail id={town} prefs={prefs} onBack={() => go('results')} />
      ) : isAdsCheckout ? (
        <AdsSandboxCheckout onDone={() => go('results')} />
      ) : route === 'account' ? (
        <Account onBack={() => go('results')} onSignIn={openSignIn} />
      ) : route === 'roommates' ? (
        <Roommates onSignIn={openSignIn} />
      ) : route === 'saved' ? (
        <SavedPlaces onBack={() => go('results')} onOpenTown={id => go(`town/${id}`)} />
      ) : route === 'results' ? (
        <Results prefs={prefs} setPrefs={setPrefs} onOpenTown={id => go(`town/${id}`)} onRestart={() => go('')} />
      ) : (
        <Quiz prefs={prefs} setPrefs={setPrefs} onDone={() => go('results')} />
      )}
    </>
  );
}
