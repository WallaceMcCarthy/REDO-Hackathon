import React, { useState } from 'react';
import { useIsSandboxPaymentAllowed, useSimulateSandboxPayment } from '../data/adsHooks';

interface AdsSandboxCheckoutProps {
  onDone: () => void;
}

export default function AdsSandboxCheckout({ onDone }: AdsSandboxCheckoutProps) {
  const isSandboxAllowed = useIsSandboxPaymentAllowed();
  const simulatePayment = useSimulateSandboxPayment();

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

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async () => {
    if (!campaignId) {
      setError('No campaign ID specified in checkout session.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await simulatePayment(campaignId, sessionId);
      if (res?.success || res?.status === 'active') {
        setSuccess(true);
      } else {
        setError('Simulation failed to activate campaign.');
      }
    } catch (err: any) {
      setError(err.message || 'Payment simulation failed. Ensure you are signed in as the campaign owner.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
        {/* Sandbox Warning Banner */}
        <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
          <span className="text-xl">⚠️</span>
          <span>SANDBOX: REDO payments not connected yet</span>
        </div>
        <p className="mt-2 text-xs text-amber-900 leading-relaxed">
          Waiting on official REDO API documentation and sandbox credentials. This in-app
          simulation demonstrates the complete checkout and activation flow without calling
          unverified external endpoints.
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
              <span className="text-emerald-700 font-medium">Automatic on webhook / simulation</span>
            </div>
          </div>
        </div>

        {/* Sandbox Gate Notice */}
        {!isSandboxAllowed && (
          <div className="mt-4 rounded-xl bg-red-50 p-4 text-xs text-red-900 border border-red-300">
            <div className="font-bold mb-1">🔒 Simulation Disabled on Production</div>
            <p>
              Sandbox simulation is disabled on this deployment (ALLOW_SANDBOX_PAYMENTS is unset).
              Paid campaigns require verified webhook confirmation from the REDO payment gateway.
            </p>
          </div>
        )}

        {/* Status Alerts */}
        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200">
            {error}
          </div>
        )}

        {success ? (
          <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-center border border-emerald-200">
            <div className="text-2xl">✅</div>
            <h3 className="mt-2 font-display text-base font-bold text-emerald-900">
              Payment Simulated Successfully!
            </h3>
            <p className="mt-1 text-xs text-emerald-700">
              Your campaign is now active and displaying on Utah Fit maps and listing results.
            </p>
            <button
              type="button"
              onClick={onDone}
              className="mt-4 cursor-pointer rounded-full bg-emerald-700 px-6 py-2 text-xs font-bold text-white hover:bg-emerald-800"
            >
              Return to Results & Dashboard
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {isSandboxAllowed && (
              <button
                type="button"
                disabled={loading}
                onClick={handleSimulate}
                className="w-full cursor-pointer rounded-full bg-purple-700 py-2.5 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50 shadow-sm"
              >
                {loading ? 'Simulating Payment...' : `Simulate Payment ($${amountDollars} USD)`}
              </button>
            )}

            <button
              type="button"
              onClick={onDone}
              className="w-full cursor-pointer rounded-full border border-rock-300 py-2 text-xs font-semibold text-rock-700 hover:bg-rock-100"
            >
              Cancel & Return
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
