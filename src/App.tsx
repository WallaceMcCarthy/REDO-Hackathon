import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { loadPrefs, savePrefs } from './prefs';
import { openSignIn } from './components/auth/AccountMenu';
import { useCities } from './data/hooks';
import Quiz from './screens/Quiz';
import { AppHeader, Button, EmptyState, Skeleton } from './components/ui';
import SafeSectionBoundary from './components/SafeSectionBoundary';
import type { Prefs } from './types';

const loadResults = () => import('./screens/Results');
const Results = lazy(loadResults);
const Account = lazy(() => import('./screens/Account'));
const AdvertiserDashboard = lazy(() => import('./components/ads/AdvertiserDashboard'));
const Messages = lazy(() => import('./screens/Messages'));
const SavedPlaces = lazy(() => import('./screens/SavedPlaces'));
const TownDetail = lazy(() => import('./screens/TownDetail'));
const UiKit = lazy(() => import('./screens/UiKit'));
const Privacy = lazy(() => import('./screens/Privacy'));
const Terms = lazy(() => import('./screens/Terms'));

// A deploy removes the old hashed chunks, so a tab left open reloads once to pick up the new ones.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('chunkReload')) return;
  sessionStorage.setItem('chunkReload', '1');
  window.location.reload();
});

const readHash = () => window.location.hash.replace(/^#\/?/, '');
export const go = (path: string) => { window.location.hash = `/${path}`; };

// Old cmascope.com paths (/markets/..., /pricing) are rewritten to this app by vercel.json; the real routes are all hash routes.
function NotFound() {
  useEffect(() => {
    const m = Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' });
    document.head.append(m);
    return () => m.remove();
  }, []);
  return (
    <main>
      <EmptyState className="m-gutter" title="That page has moved" description="cmascope.com is now Utah Fit, a way to rank Utah towns by what matters to you." action={<Button href="/">Find a home in Utah</Button>} />
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState(readHash);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const lastResults = useRef(route.startsWith('results') ? route : 'results');

  useEffect(() => {
    const onChange = () => {
      const next = readHash();
      if (next.startsWith('results')) lastResults.current = next;
      setRoute(next);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  useEffect(() => savePrefs(prefs), [prefs]);

  // Most visitors go on to results, so fetch the map after the landing page has painted.
  useEffect(() => {
    const warm = setTimeout(loadResults, 2000);
    return () => clearTimeout(warm);
  }, []);

  const backToResults = () => go(lastResults.current);
  const cities = useCities();
  const town = route.match(/^town\/(.+)$/)?.[1];
  const [path, query] = route.split('?');
  const params = new URLSearchParams(query);
  const homesTown = params.get('town');
  const view = params.get('view');
  const isMessages = path === 'messages' || path.startsWith('messages/');

  if (!['/', '/index.html'].includes(window.location.pathname)) return <NotFound />;

  return (
    <div className={path === 'results' || isMessages ? 'flex h-dvh flex-col' : undefined}>
      {route !== 'ui' && <AppHeader route={route} />}
      <Suspense fallback={<div aria-busy="true" className="flex min-h-64 flex-1 p-gutter"><Skeleton className="flex-1" /></div>}>
        {route === 'ui' ? (
          <UiKit />
        ) : town ? (
          <TownDetail id={town} prefs={prefs} onBack={backToResults} />
        ) : route === 'account' ? (
          <Account onBack={backToResults} onSignIn={openSignIn} />
        ) : route === 'saved' ? (
          <SavedPlaces onBack={backToResults} onOpenTown={id => go(`town/${id}`)} />
        ) : route === 'privacy' ? (
          <Privacy onBack={backToResults} />
        ) : route === 'terms' ? (
          <Terms onBack={backToResults} />
        ) : isMessages ? (
          <SafeSectionBoundary key={route} fallback={<EmptyState className="m-gutter" title="That conversation is not available" action={<Button href="#/messages">Back to messages</Button>} />}>
            <Messages conversationId={path.split('/')[1]} onSignIn={openSignIn} onBack={backToResults} />
          </SafeSectionBoundary>
        ) : route === 'advertise' || path === 'ads' ? (
          <AdvertiserDashboard cities={cities ?? []} onBack={backToResults} />
        ) : path === 'results' ? (
          <Results
            prefs={prefs} setPrefs={setPrefs} onOpenTown={id => go(`town/${id}`)} onRestart={() => go('')}
            view={!homesTown && (view === 'apartments' || view === 'areas') ? view : 'homes'} townFilter={homesTown} openListing={params.get('listing')}
          />
        ) : (
          <Quiz prefs={prefs} setPrefs={setPrefs} onDone={mode => go(mode === 'rent' ? 'results?view=apartments' : 'results')} />
        )}
      </Suspense>
      {!(path === 'results' || isMessages) && route !== 'ui' && (
        <footer className="mt-auto px-gutter py-4 text-center text-small text-text-muted">
          <a href="#/privacy" className="underline underline-offset-2 hover:text-text">Privacy</a>
          <span aria-hidden="true" className="px-2">·</span>
          <a href="#/terms" className="underline underline-offset-2 hover:text-text">Terms</a>
        </footer>
      )}
    </div>
  );
}
