import { Button, Card, PageHeader } from '../components/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="min-w-0 space-y-2">
      <h2 className="font-display text-title text-text">{title}</h2>
      <div className="space-y-2 text-body text-text-muted">{children}</div>
    </Card>
  );
}

export default function Privacy({ onBack }: { onBack: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-gutter pb-section pt-stack">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-4">← Back</Button>
      <div className="mt-2 space-y-stack">
        <PageHeader title="Privacy Policy" description="Draft — not legal advice. This describes what Utah Fit actually does today, in plain language, while the team finalizes a reviewed policy." />

        <Section title="What we collect">
          <p>If you create an account: your email and password (handled by our authentication provider; we never see your password itself), and anything you add to your profile — display name, target town, move-by date, budget, and household size. All profile fields are optional and you can clear them at any time.</p>
          <p>If you use the app: your weighted priorities and filters (stored in your browser, not on our servers, unless you&apos;re signed in and they&apos;re tied to your account), homes or apartments you save, and any comments, direct messages, or advertiser listings you create.</p>
          <p>We do not collect payment card details — test-mode payments are handled entirely by Stripe (see Terms).</p>
        </Section>

        <Section title="Public data sources">
          <p>Town rankings and metrics come from public sources — the U.S. Census Bureau, UGRC (Utah&apos;s state GIS agency), HUD, OpenStreetMap, UTA transit data, EPA, FBI/Utah BCI crime data, and others — never from anything about you personally. Each metric on a town page links to its real source. Home and apartment listings come from RentCast (live market data) and public county assessor records, each labeled by source.</p>
        </Section>

        <Section title="Comments, messages, and moderation">
          <p>Comments you post on towns or listings are public and attributed to your display name. Direct messages are private between you and the other participant; our systems do not use message content for anything other than delivering it and basic safety moderation. We use automated review (and may use human review) to catch spam, scams, and policy violations in new comments, messages, and ads; flagged content may be hidden or held pending review.</p>
        </Section>

        <Section title="Advertising">
          <p>If you create an ad campaign, its text, image, link, and location are public once active. Free-tier ads and paid ads (processed via Stripe in test mode — no real money moves) are both subject to the same moderation described above.</p>
        </Section>

        <Section title="Account deletion">
          <p>You can delete your account from the Account page at any time. Your profile and ability to sign in are removed immediately. Other data you created — comments, messages, saved places, ad campaigns — is removed or anonymized shortly after on a cleanup pass; payment records are kept for accounting as Stripe requires.</p>
        </Section>

        <Section title="Questions">
          <p>This is a hackathon project. There is no company or support address yet — see Terms for the current status.</p>
        </Section>
      </div>
    </main>
  );
}
