import { Button, Card, PageHeader } from '../components/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="min-w-0 space-y-2">
      <h2 className="font-display text-title text-text">{title}</h2>
      <div className="space-y-2 text-body text-text-muted">{children}</div>
    </Card>
  );
}

export default function Terms({ onBack }: { onBack: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-gutter pb-section pt-stack">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-4">← Back</Button>
      <div className="mt-2 space-y-stack">
        <PageHeader title="Terms of Use" description="Draft — not legal advice. Utah Fit is an in-progress hackathon project; these terms describe how it works today and will be reviewed before any public launch." />

        <Section title="What Utah Fit is">
          <p>Utah Fit helps you rank Utah towns and browse homes and apartments against your own priorities, using public data and licensed listing data. Estimated home values are county assessor records, not asking prices. Apartment rent figures are HUD area benchmarks, not a specific unit&apos;s asking rent, unless marked as a live market listing. We try to label every number honestly — if something looks wrong, please flag it.</p>
        </Section>

        <Section title="No warranty, not advice">
          <p>Utah Fit is provided as-is, with no warranty of accuracy, availability, or fitness for any purpose. It is not financial, legal, or real estate advice. Always verify a home&apos;s actual price, availability, and condition independently before making a decision.</p>
        </Section>

        <Section title="Accounts and conduct">
          <p>You&apos;re responsible for what you post — comments, messages, and ad campaigns must be your own content, lawful, and not harassing, discriminatory (including in a way that would violate fair housing law), fraudulent, or spam. We may remove content or suspend accounts that violate this, using a mix of automated and human review.</p>
        </Section>

        <Section title="Payments">
          <p>Advertising can be purchased through Stripe. Today, Stripe is in <strong>test mode</strong>: no real payment is processed and no real money changes hands, even though the checkout flow looks real. A free, limited daily tier exists so you can try advertising without any payment at all. This will be clearly communicated before real payments are ever enabled.</p>
        </Section>

        <Section title="Sample content">
          <p>Some towns, comments, and ads you may see are clearly labeled sample/demo content, used to show what the app looks like with activity. Sample content does not represent real people or real advertisers.</p>
        </Section>

        <Section title="Changes">
          <p>Because this is an active project, these terms and the app itself may change at any time without notice. A reviewed, final version will replace this draft before any public launch.</p>
        </Section>
      </div>
    </main>
  );
}
