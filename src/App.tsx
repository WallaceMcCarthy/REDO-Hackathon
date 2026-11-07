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

// Lets anyone see how fresh the live site is. VITE_BUILD_ID is set at deploy time.
function BuildStamp() {
  const id = import.meta.env.VITE_BUILD_ID as string | undefined;
  return id ? <p className="pointer-events-none fixed bottom-1 left-2 z-[1100] text-[10px] text-dusk">{id}</p> : null;
}

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
      <AccountMenu />
      {town ? (
        <TownDetail id={town} prefs={prefs} onBack={() => go('results')} />
      ) : isAdsCheckout ? (
        <AdsSandboxCheckout onDone={() => go('advertise')} />
      ) : route === 'roommates' ? (
        <Roommates onSignIn={openSignIn} />
      ) : route === 'results' || route === 'advertise' ? (
        <Results prefs={prefs} setPrefs={setPrefs} onOpenTown={id => go(`town/${id}`)} onRestart={() => go('')} initialViewMode={route === 'advertise' ? 'ads' : 'main'} />
      ) : (
        <Quiz prefs={prefs} setPrefs={setPrefs} onDone={() => go('results')} />
      )}
      <BuildStamp />
    </>
  );
}
