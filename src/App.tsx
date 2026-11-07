import { useEffect, useState } from 'react';
import { defaultPrefs } from './prefs';
import { openSignIn } from './components/auth/AccountMenu';
import Account from './screens/Account';
import AdvertiserDashboard from './components/ads/AdvertiserDashboard';
import { useCities } from './data/hooks';
import Quiz from './screens/Quiz';
import Messages from './screens/Messages';
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

  const cities = useCities();
  const town = route.match(/^town\/(.+)$/)?.[1];
  const [path, query] = route.split('?');
  const params = new URLSearchParams(query);
  const homesTown = params.get('town');
  const view = params.get('view');
  const isAdsCheckout = route.startsWith('ads-sandbox-checkout');

  return (
    <div className={path === 'results' ? 'flex h-dvh flex-col' : undefined}>
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
      ) : path === 'messages' || path.startsWith('messages/') ? (
        <Messages conversationId={path.split('/')[1]} onSignIn={openSignIn} onBack={() => go('results')} />
      ) : route === 'advertise' ? (
        <AdvertiserDashboard cities={cities ?? []} onBack={() => go('results')} />
      ) : path === 'results' ? (
        <Results
          prefs={prefs} setPrefs={setPrefs} onOpenTown={id => go(`town/${id}`)} onRestart={() => go('')}
          view={!homesTown && (view === 'apartments' || view === 'areas') ? view : 'homes'} townFilter={homesTown}
        />
      ) : (
        <Quiz prefs={prefs} setPrefs={setPrefs} onDone={() => go('results')} />
      )}
    </div>
  );
}
