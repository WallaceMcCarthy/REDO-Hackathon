import { useEffect, useState } from 'react';
import { USING_MOCK_DATA } from './data/hooks';
import { defaultPrefs } from './prefs';
import Quiz from './screens/Quiz';
import Results from './screens/Results';
import TownDetail from './screens/TownDetail';
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
  return (
    <>
      {USING_MOCK_DATA && (
        <div className="bg-rock-800 px-4 py-1 text-center text-xs font-semibold text-white">MOCK DATA, not real numbers</div>
      )}
      {town ? (
        <TownDetail id={town} prefs={prefs} onBack={() => go('results')} />
      ) : route === 'results' ? (
        <Results prefs={prefs} setPrefs={setPrefs} onOpenTown={id => go(`town/${id}`)} onRestart={() => go('')} />
      ) : (
        <Quiz prefs={prefs} setPrefs={setPrefs} onDone={() => go('results')} />
      )}
    </>
  );
}
