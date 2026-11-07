import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexError } from 'convex/values';
import { PreferenceAssistantForm } from '../../src/components/PreferenceAssistant';
import { defaultPrefs } from '../../src/prefs';
import '../../src/index.css';

function Fixture() {
  const [prefs, setPrefs] = useState(defaultPrefs);
  const fail = new URLSearchParams(location.search).has('fail');
  return <main className="mx-auto max-w-3xl p-gutter">
    <h1 className="font-display text-heading">Preference assistant test fixture</h1>
    <PreferenceAssistantForm prefs={prefs} setPrefs={setPrefs} isAuthenticated onSignIn={() => {}}
      run={async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
        if (fail) throw new ConvexError('Suggestion limit reached. Please try again later or adjust the sliders yourself.');
        return { categories: { outdoors: 5, culture: 1 }, budget: { mode: 'rent', maxRent: 2000 }, uncertain: ['schools and education'], model: 'jev-1.14.0' };
      }} />
    <output data-testid="current-settings" className="mt-4 block break-all">{JSON.stringify(prefs)}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
