export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500';
export const BTN = `inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${FOCUS}`;
export const BTN_PRIMARY = `${BTN} bg-rock-600 text-white hover:bg-rock-800`;
export const BTN_QUIET = `${BTN} border border-rock-100 bg-white text-ink hover:border-rock-300`;
export const LINK = `rounded text-sm font-semibold text-alpine-700 underline underline-offset-2 hover:text-alpine-900 ${FOCUS}`;

export const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
export const rentFmt = (n: number) => `$${Math.round(n).toLocaleString()}/mo`;
