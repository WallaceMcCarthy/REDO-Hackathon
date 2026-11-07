import React from 'react';

interface AdsSandboxCheckoutProps {
  onDone: () => void;
}

export default function AdsSandboxCheckout({ onDone }: AdsSandboxCheckoutProps) {
  // Extract query parameters from window hash or search
  const hash = window.location.hash;
  const queryString = hash.includes('?') ? hash.split('?')[1] : window.location.search.replace(/^\?/, '');
  const params = new URLSearchParams(queryString);

  const sessionId = params.get('sessionId') || 'redo_sandbox_preview';
  const campaignId = params.get('campaignId') || '';
  const amountStr = params.get('amount') || '3500';
  const currency = params.get('currency') || 'USD';
  const title = params.get('title') || 'Sponsored Campaign';

  const amountDollars = (Number(amountStr) / 100).toFixed(2);

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
        {/* Sandbox Notice Banner */}
        <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
          <span className="text-xl">⚠️</span>
          <span>SANDBOX: REDO payments not connected yet</span>
        </div>
        <p className="mt-2 text-xs text-amber-900 leading-relaxed">
          Waiting on official REDO API documentation and merchant credentials. In accordance with
          Phase 3 ground rules, campaigns remain in <code>pending_payment</code> status until a verified
          REDO webhook signature is received by the backend.
        </p>

        {/* Order Details Card */}
        <div className="mt-6 rounded-2xl border border-rock-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex justify-between items-baseline border-b border-rock-100 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-ink">{title}</h2>
              <p className="text-[11px] text-dusk font-mono">Campaign: {campaignId || 'demo'}</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-ink">${amountDollars}</div>
              <div className="text-[10px] text-dusk uppercase">{currency}</div>
            </div>
          </div>

          <div className="text-xs text-rock-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-dusk">Session ID:</span>
              <span className="font-mono text-[11px] text-rock-800">{sessionId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dusk">Gateway:</span>
              <span className="font-semibold text-purple-700">REDO Payments (Sandbox Stub)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dusk">Fulfillment:</span>
              <span className="text-amber-700 font-medium">Pending Webhook Confirmation</span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onDone}
            className="w-full cursor-pointer rounded-full bg-purple-700 py-2.5 text-xs font-bold text-white hover:bg-purple-800 shadow-sm"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}
