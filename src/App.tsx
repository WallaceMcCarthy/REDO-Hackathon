import { useEffect, useState } from 'react';
import { defaultPrefs } from './prefs';
import AccountMenu, { openSignIn } from './components/auth/AccountMenu';
import Quiz from './screens/Quiz';
import Results from './screens/Results';
import Roommates from './screens/Roommates';
import TownDetail from './screens/TownDetail';
import AdsSandboxCheckout from './screens/AdsSandboxCheckout';
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
  const isAdsReturn = /^ads(\?|$)/.test(route);
  const isAdsCheckout = route.startsWith('ads-sandbox-checkout');

  return (
    <>
      <AccountMenu />
      {town ? (
        <TownDetail id={town} prefs={prefs} onBack={() => go('results')} />
      ) : isAdsCheckout ? (
        <AdsSandboxCheckout onDone={() => go('results')} />
      ) : route === 'roommates' ? (
        <Roommates onSignIn={openSignIn} />
      ) : route === 'results' || isAdsReturn ? (
        <Results prefs={prefs} setPrefs={setPrefs} onOpenTown={id => go(`town/${id}`)} onRestart={() => go('')} initialView={isAdsReturn ? 'ads' : 'main'} />
      ) : (
        <Quiz prefs={prefs} setPrefs={setPrefs} onDone={() => go('results')} />
      )}
    </>
  );
}
