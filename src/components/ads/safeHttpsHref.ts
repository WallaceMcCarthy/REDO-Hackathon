/** Defense-in-depth: only allow https URLs to be rendered into href */
export function safeHttpsHref(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') return parsed.toString();
  } catch {}
  return undefined;
}

/** Ad images are https, or the bundled sample art that only the internal seed can set. */
export function safeImageSrc(rawUrl?: string): string | undefined {
  return rawUrl?.startsWith('/sample-ads/') ? rawUrl : safeHttpsHref(rawUrl);
}
