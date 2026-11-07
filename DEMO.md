# Utah Fit: 2-minute demo script

Every click and result below was run in the live app against the shared Convex backend on 2026-11-06, with 42 towns and 15 metrics.

**Before presenting:** run all three personas again. Rankings move when data changes, and the trails, transit, restaurant and venue data were still being rebuilt when this was written. If a town below no longer matches, say what the screen shows. Never quote a number that isn't on screen.

**Setup:** open the app on the landing page, on a laptop. Nothing selected.

## 0:00 to 0:20. The problem

**Action:** show the landing page.

> "Utah isn't one place. Living in Park City is nothing like living in Lehi, Moab or Logan. Today, people moving here juggle a dozen tabs to work out where they belong. Utah Fit ranks 42 Utah towns on public data, weighted by what you care about."

## 0:20 to 0:50. Skier

**Action:** click **Skier**. Point out that the sliders moved, then click **Show my towns**.

**Expect:** Park City, Heber City and Midway on top. Park City shows "Best for ski resort access".

> "Pick a persona and the sliders set themselves. For a skier, the Wasatch Back comes out on top, and the badges say why."

**Action:** drag one slider on the left.

> "It's live. Every slider re-ranks all 42 towns and the map instantly."

## 0:50 to 1:20. Family

**Action:** click **Change my answers**, turn Skier off, click **Family**, then **Show my towns**. Drag **Max home value** to the left.

**Expect:** the mountain towns drop out of the lead. Ephraim, Kaysville, Lehi, Bountiful and South Jordan sit within about a point of each other at the top. The count above the list falls as the cap tightens.

> "Same data, different person. A family puts safety, schools and cost first, so the top of the list changes completely. A budget cap removes towns they can't afford, from the list and the map."

## 1:20 to 1:45. Why should you believe it?

**Action:** click the top town to open its detail page. Open one source link.

> "No black box. Every metric sits next to the Utah median, says in plain words whether this town is better or worse, and links to where the number came from."

## 1:45 to 2:00. Close

> "Utah Fit is React and TypeScript on a Convex backend. Its data comes from the Census Bureau, the EPA, the Utah Bureau of Criminal Identification, the Utah Transit Authority, the National Park Service and OpenStreetMap. Tell it what matters, and it shows you where you fit."

## If something goes wrong

- **Map tiles don't load:** keep going. The ranked list doesn't depend on them.
- **"We couldn't load the towns":** click **Reload**.
- **Foodie:** leave it out until restaurant data lands. Until then its ranking leans on transit.
