# Utah Fit demo script

This is a 3-minute walkthrough of https://cmascope.com. It is read-only. Every step below was run on the live site on 2026-11-06, in Chrome at 1440x900 and again at 390x844, with the build stamp reading `a6a67fa`.

## Before you present

Rankings move when the data or the scoring changes. Run the path once first. If a town or number below no longer matches, say what the screen shows. Never quote a number that is not on screen.

Open https://cmascope.com on a laptop with nothing selected. On a phone, the list and the map are two panes. Tap **List** or **Map** under the filters to switch.

## 0:00 to 0:20. The problem

Show the start page.

> Utah is not one place. Park City, Lehi, Moab and Logan are different lives. People moving here juggle a dozen tabs to work out where they fit. Utah Fit ranks homes across 42 Utah towns on public data, weighted by what you care about.

## 0:20 to 0:50. Pick a persona

Leave **Buy** selected and the price blank. Click **Skier**. The sliders move to Cost of living 1, Safety 0, Air & water 3, Outdoors 5, and 0 for the rest. Click **Show my matches**.

You see "Showing 60 homes in 8 areas · 640 matches". The list is grouped by area, and Heber City comes first at 74 / 100, then Midway at 73 / 100. Each card shows an estimated value, an address, a score bar, and a line that starts "Why this place".

> Pick a persona and the sliders set themselves. Personas stack, so you can pick two and fine tune after. The value is a county assessor estimate, not an asking price. The "i" next to it says so.

## 0:50 to 1:10. Open a home

Click a card. On a laptop a panel opens over the map. On a phone a sheet slides up, and you can swipe it down. The panel has an aerial photo or a Zillow photo, the score, the "Why this place" line, a link to Zillow, a link to the town page, and a comment box. The arrows step through the 60 homes (the counter reads 1 / 60). Press Escape or the close button to leave.

> Every home is a real county record. The score is the score of its town for your priorities.

## 1:10 to 1:30. Show the data behind the score

On a phone, tap **Map** first. In the **Map layer** control choose **Median home value**.

The map turns into a heat map. The legend shows 251,322 to 1,757,800 USD and says "Better: lower values". The note under it says colour shows each town's rank among the 42 measured towns, and that colours between towns are estimated.

> Any of the 21 metrics can be a layer. Green is always better. The grey dots are the measured towns. Everything between them is interpolated, and the legend says so.

## 1:30 to 1:45. Set a budget

On a phone, tap **List**. Set **Max price** to **$500k**.

The count drops to "172 matches" for the Skier answers. The list and the map pins both narrow.

## 1:45 to 2:20. Compare areas and check a source

Open **Areas**. The page reads "All 42 areas ranked". Heber City, Midway and Park City are first, with 74, 73 and 71 out of 100. Each row has a "Why it fits" line, the median home value and the median rent.

Click **See homes in Heber City**. The list filters to one area and shows a "Heber City (clear)" chip. Go back to **Areas** and click **About Heber City**.

The town page shows the fit score and rank ("ranked 1 of 42"), the places to live there, and a section called **The numbers**. Each metric sits next to the Utah median, says whether the town is better or worse, and gives the source and year. For Heber City, median home value is 728,790 USD against a Utah median of 554,100, marked "Worse than the Utah median, 32% higher".

> No black box. Every score traces to a Census, EPA, UTA, Utah BCI or OpenStreetMap number you can read.

## 2:20 to 2:40. Rent instead of buy

On a laptop, click **Change my answers**. On a phone, tap the **Utah Fit** logo, because the link is hidden at that width. Choose **Rent**, type 2000 in **Max rent per month**, click **Family**, and click **Show my matches**.

You land on the **Apartments** view: "Showing 60 apartments in 8 areas · 128 matches". Cards show "HUD 2-bed fair market rent", not a listing price.

> Apartments are real complexes. The rent is the federal fair market rent for the ZIP code.

## 2:40 to 3:00. Accounts, then close

Click **Messages**, then **Saved**, then the heart on a home. Each asks you to sign in or create an account. Click **Advertise**. The page asks you to sign in before you can publish an ad.

> Saving, comments, messages, roommates and ads need an account. Ads are always labelled Sponsored, and nothing goes live until a payment is confirmed.

Close.

> Utah Fit is React and TypeScript on Convex. Tell it what matters, and it shows you where you fit.

## Not run on the live site

These need an account or create real data, so no step above runs them. `e2e/signed-in.spec.ts` covers them against a local Convex backend.

- Creating an account and signing in.
- Saving a home, and the My saved places list.
- Posting a comment, posting to a town feed, and reporting.
- Sending a message.
- Creating a roommate profile or a connection.
- Publishing an ad and seeing it on its town page.

## Avoid in a live demo

Each of these was seen on the live site on 2026-11-06.

- **Sort: Lowest estimated value.** The first home is an "Est. value" of $3k, a county record with an implausibly low assessed value. Use **Best fit**.
- **Rent with no number.** Choosing **Rent** and leaving the rent blank opens the Homes view, not Apartments. Type a rent first.
- **Roommate finder.** It exists at `#/roommates`, but no link in the app leads to it.
- **Zillow photos.** Some homes show the Zillow logo in place of a photo.

## If something goes wrong

- **Map tiles do not load.** Keep going. The ranked list does not depend on them.
- **A page says it could not load.** Reload. The data comes from one Convex deployment.
- **The numbers differ from this script.** Say what the screen shows. The build stamp names the commit and deploy time. It is at the bottom-left of the page today, and moves into the header in commit `1ad3d1d`.
