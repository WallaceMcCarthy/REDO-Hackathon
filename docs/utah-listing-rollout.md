# Retained statewide Utah listings

All 26,140 provider records were retained in `marketListings`. About 3,748 have no scored town within 15 km. Global browsing can include eligible records from that group without another provider request.

`UTAH_STATEWIDE_ENABLED` defaults off. Enable it on DEV, verify the audit and search, and enable production only after the deployment owner has completed the audit below. No additional schema or external credential is needed.

When enabled, Best fit exhausts scored-town inventory before the unranked group. Lowest price and Newest built merge all eligible records by their actual asking amount/year. Town-specific, commute-filtered and town-value-filtered searches exclude unranked locations. Every unranked card/panel shows **No area score**, with null rank/score, its actual source city, and no invented About-town link. Saving, comments and conversation contexts resolve the same stable market ID.

## Operator audit

1. Deploy Convex before shipping the frontend.
2. On DEV and PROD, call internal mutation `marketSeed:purgeNonUtahPage` with `{ "cursor": null }`. It is read-only by default. Repeat with each returned `continueCursor` until `isDone`, sum `checked`, `matched`, `eligibleOutsideTown` and `unlocatedPricedResidential`, and retain the sample evidence. Page size is at most 200.
3. Post real counts and examples before any deletion. Per the coordinator's current instruction, deletion still needs the human's approval after the preview. Never infer outside-Utah status merely from null `cityId` or missing fields.
4. If approved, repeat the full pass from cursor null with `dryRun:false`. Only affirmative non-Utah matches are deleted. Missing-coordinate records remain stored but are removed from the displayable inventory index. Exact price/newest metadata is rebuilt only for affected keys, avoiding repeated rewrites of every town's index. If both `matched` and `unlocatedPricedResidential` were zero, no repair pass is needed.
5. Read-only internal query `marketSeed:auditLegacyUtahPage` audits the old assessor/HUD/OSM `listings` sample table. It never deletes shared social targets. The separate assessor source uses official Utah municipal containment; audit that table separately if it has been loaded.
6. Verify totals, price/budget ordering, cursor pages, saves and panels on DEV. Then enable `UTAH_STATEWIDE_ENABLED=true` for production and confirm the same public responses.

Evidence uses the full Census TIGER/Line 2024 Utah polygon (7,490 vertices, 178 KB), not its bounding rectangle. An explicit address state other than UT, non-84 ZIP, or finite coordinates outside that polygon qualifies. The northeast Wyoming step is covered. Unknown fields alone are preserved. Source and extraction instructions are in `data/utah-state-boundary.json` and `scripts/data/utah_state_boundary.py`.

## Verification

Unit coverage includes all three sort modes, budget and town/commute scope, duplicate-free price ties, no fabricated rank, deleted/retained records and exact derived counts. The isolated local fixture has 26,180 synthetic market rows; six kind/sort combinations each passed six pages with 360 distinct IDs.

`e2e/unranked-listings.spec.ts` is explicitly local-fixture-only: run with `E2E_RURAL_FIXTURE=1` against a local preview and locally seeded `unranked-fixture-*` records. Desktop and 390px screenshots verify asking-price/rent labels, unavailable score/link suppression, and no horizontal overflow. Normal production smoke skips these synthetic identifiers.
