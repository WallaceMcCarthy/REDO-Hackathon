# Jev preference suggestions

The start page turns a description into existing category priorities and a housing budget. Per the human's auto-apply request, **Set my priorities** applies supported changes immediately and shows what changed. Every slider remains editable. Unmentioned categories stay unchanged. Ambiguous settings are listed for the user to set themselves. The existing town scoring stays deterministic.

## Rollout

- Deploy Convex before the frontend. `jevQuota` is a new transient counter table.
- Store `JEV_API_KEY` in Convex only; it is already configured by the deployment owner. Never put it in a Vite variable, git, logs or board messages.
- The feature is hidden and API calls are blocked unless `JEV_PREFERENCES_ENABLED=true`. Leave this flag off until a human approves live testing and rollout.
- Requests require a current signed-in account. Quotas are transactional: 3 calls per minute, 20 per UTC day per account, 200 per UTC day globally. Failed provider calls count, too. Input is capped at 1,200 characters and each call times out after 15 seconds; no automatic retries.
- Counters expire at minute/day boundaries and are removed in bounded batches during subsequent requests. Prompts, model responses and contact details are not stored by this feature.

The server calls only `https://api.typesafe.ai/v1/systemone`, pins `jev-1.14.0`, and sends only the entered description. It does not send the account profile, messages, browsing history or existing preferences. Provider errors become a plain retry message without returning provider bodies. This feature uses text questions, so the experimental Images header is not needed. Image requests in a separate prototype would require `TypeSafe-Danger-Zone-Images: true`.

Budget amounts are selected from exact numeric candidates extracted by code, including `2k`, `1.2m` and comma-separated values. Jev cannot introduce an amount outside that list. Both the housing mode and budget must be clearly stated before an amount is set. A user can correct any interpretation through the budget field and sliders.

## Validation

`npx vitest run convex/jev.test.ts convex/lib/jev.test.ts` runs actual Convex handlers with a stubbed provider and tests parsing, authentication, deleted accounts, rollout controls, per-user/global quotas and provider failures. No provider calls are made.

`e2e/jev-preferences.spec.ts` uses a Vite **dev** server and `/e2e/fixtures/jev.html`. The synthetic fixture exercises auto-apply, unchanged unmentioned priorities and visible errors at desktop and 390px. These fixture files are not inputs to the production build. Existing quiz and listing regressions run against a production build served by Vite preview.

The approved 20-request DEV trial completed on 2026-11-07: 18 matched all scenario checks, 0 provider errors. Buying/renting, exact budgets (`2k`, `1.2m`, price ranges, conflicting numbers and revised budgets), negation, and Spanish preferences worked. English and French air-only requests both left the environmental priority unchanged and flagged it as uncertain. The original compound “air and water quality” wording has therefore been replaced with “environmental quality”; a separate four-request follow-up is awaiting authorization and deployment. Do not claim that wording change is live-validated yet.

Observed request latency: minimum 177 ms, median 257 ms, p95 357 ms, maximum 368 ms. These are 20 sequential DEV requests, not a load benchmark. The current app response does not expose provider token usage, so actual billed cost was not measured. At the documented $0.042 per million input tokens and default 64k request ceiling, a conservative ceiling for 20 requests is about $0.054, below the approved $0.25 trial budget. Output tokens are free per the [current model documentation](https://docs.typesafe.ai/models).

Use synthetic descriptions for follow-ups, inspect actual outputs and avoid exact-probability assertions. Do not replace a model uncertainty with an arbitrary hardcoded answer.

Sources: [official skill](https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md), [Choice](https://docs.typesafe.ai/primitives/choice), [Score](https://docs.typesafe.ai/primitives/score), [Noul](https://docs.typesafe.ai/primitives/noul), [API schema](https://api.typesafe.ai/openapi.json).
