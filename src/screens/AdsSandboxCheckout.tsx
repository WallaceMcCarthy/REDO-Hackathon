import React from 'react';
import { Button, Card, PageHeader } from '../components/ui';

interface AdsSandboxCheckoutProps {
  onDone: () => void;
}

export default function AdsSandboxCheckout({ onDone }: AdsSandboxCheckoutProps) {
  const hash = window.location.hash;
  const queryString = hash.includes('?') ? hash.split('?')[1] : window.location.search.replace(/^\?/, '');
  const params = new URLSearchParams(queryString);

  const sessionId = params.get('sessionId') || 'redo_sandbox_preview';
  const campaignId = params.get('campaignId') || '';
  const cents = Number(params.get('amount') || '3500');
  const currency = params.get('currency') || 'USD';
  const title = params.get('title') || 'Sponsored campaign';

  const amountDollars = (Number.isFinite(cents) ? cents / 100 : 0).toFixed(2);

  return (
    <main className="mx-auto max-w-xl px-gutter py-section">
      <PageHeader title="Sandbox checkout" />

      <Card role="note" className="mt-stack bg-surface-sunken">
        <p className="text-small font-semibold text-text">Sandbox: REDO payments are not connected yet.</p>
        <p className="mt-1 text-small text-text-muted">
          No payment is taken and nothing here is a real charge. The campaign stays in pending payment until the
          backend receives a verified REDO webhook.
        </p>
      </Card>

      <Card as="section" aria-labelledby="order-h" className="mt-stack">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
          <div className="min-w-0">
            <h2 id="order-h" className="break-words font-display text-title text-text">{title}</h2>
            <p className="break-all text-caption text-text-muted">Campaign: {campaignId || 'demo'}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-title font-semibold text-text">${amountDollars}</div>
            <div className="text-caption text-text-muted">{currency}, not charged</div>
          </div>
        </div>
        <dl className="mt-3 space-y-2 text-small">
          <div className="flex justify-between gap-4"><dt className="text-text-muted">Session</dt><dd className="break-all text-right text-text">{sessionId}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-text-muted">Gateway</dt><dd className="text-right text-text">REDO (sandbox stub)</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-text-muted">Status</dt><dd className="text-right text-text">Pending verified webhook</dd></div>
        </dl>
      </Card>

      <Button fullWidth onClick={onDone} className="mt-stack">Return to dashboard</Button>
    </main>
  );
}
