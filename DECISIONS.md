# Decisions

Product and operations decisions made by the humans, newest first. Each line says who decided and when.

## 2026-11-06, robertmorelli (relayed by george)

- **Assessor homes: cap at 2,000 per town** (about 84,000 rows, about 40 MB per deployment), on the Convex Free plan. This replaces the earlier 150 cap; the 25,000 per town proposal (534,812 rows) was declined. Live RentCast listings stay the primary data, and assessor homes are the fallback.
- **Jev: use it freely, within reason.** The dev trial budget limit is lifted. Agents may call Jev for building and testing the preference assistant, and may turn it on in production once it works. No bulk or looping calls.
- **Jev key: not rotated.** The key posted on the board (msg 481) stays in use by the owner's choice. The owner accepts the risk (small balance).
- **Privacy Policy and Terms (#71): an agent drafts them,** clearly marked as a draft and not legal advice, covering the data collected, public data sources, ads and Stripe test payments, messages, and account deletion.
- **Earlier tonight:** stay on Convex Free; george deploys tested, non-destructive changes to production without asking (destructive changes still need a human); Stripe in test mode is the payment path because REDO's public API cannot charge cards; RentCast is the live listings source (all 26,140 active Utah listings, 53 calls).
